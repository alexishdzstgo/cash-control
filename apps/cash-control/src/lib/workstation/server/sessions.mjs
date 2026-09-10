// @ts-check
import "server-only";
import { authenticateMemberPassword } from "./authenticate-member.mjs";
import { createWorkstationClients } from "./clients.mjs";
import {
  isUuid,
  rpc,
  safeIdentity,
  safeString,
  sessionOperation,
  WorkstationSessionError,
} from "./shared.mjs";
import {
  generateSessionToken,
  hashSessionToken,
  isSessionToken,
  OPERATOR_TTL_MS,
  WORKSTATION_TTL_MS,
} from "./tokens.mjs";

/** @typedef {import('./clients.mjs').WorkstationClients} Clients */

/** @param {string} token @param {Clients} clients */
async function resolveStation(token, clients) {
  if (!isSessionToken(token)) return null;
  const rows = await rpc(clients.admin, "admin_resolve_workstation_session", {
    p_token_hash: hashSessionToken(token),
  });
  const row = rows?.[0];
  if (!row) return null;
  const expiresAt = safeString(row.workstation_expires_at);
  if (!(Date.parse(expiresAt) > Date.now())) return null;
  return {
    id: safeString(row.workstation_session_id),
    businessId: safeString(row.business_id),
    businessSlug: safeString(row.business_slug),
    expiresAt,
  };
}

/** @param {string} token @param {Clients} clients */
async function requireStation(token, clients) {
  const station = await resolveStation(token, clients);
  if (!station) throw new WorkstationSessionError("INVALID_SESSION");
  return station;
}

/** @param {string} name @param {string} tokenHash @param {Clients} clients */
async function revoke(name, tokenHash, clients) {
  await rpc(clients.admin, name, { p_token_hash: tokenHash });
}

/** @param {string} stationToken @param {string} memberId @param {string} stationExpiry @param {Clients} clients */
async function issueOperator(stationToken, memberId, stationExpiry, clients) {
  const operatorExpiresAt = new Date(
    Math.min(Date.now() + OPERATOR_TTL_MS, Date.parse(stationExpiry)),
  ).toISOString();
  const operatorToken = generateSessionToken();
  const tokenHash = hashSessionToken(operatorToken);
  try {
    const id = await rpc(clients.admin, "admin_issue_operator_session", {
      p_workstation_token_hash: hashSessionToken(stationToken),
      p_member_id: memberId,
      p_token_hash: tokenHash,
      p_expires_at: operatorExpiresAt,
    });
    safeString(id);
    return { operatorToken, operatorExpiresAt };
  } catch {
    // If the response was lost after commit, revoke the undelivered token.
    try {
      await revoke("admin_revoke_operator_session", tokenHash, clients);
    } catch {
      throw new WorkstationSessionError("CLEANUP_PENDING");
    }
    throw new WorkstationSessionError("UNAVAILABLE");
  }
}

/** Raw tokens are a SERVER-ONLY handoff for future HttpOnly cookies, not DTOs.
 * @param {import('./authenticate-member.mjs').PasswordInput} input @param {Clients} [dependencies]
 */
export async function startWorkstationWithPassword(input, dependencies) {
  return sessionOperation(async () => {
    const clients = dependencies ?? createWorkstationClients();
    const identity = await authenticateMemberPassword(input, clients);
    const workstationToken = generateSessionToken();
    const tokenHash = hashSessionToken(workstationToken);
    const workstationExpiresAt = new Date(
      Date.now() + WORKSTATION_TTL_MS,
    ).toISOString();
    try {
      safeString(
        await rpc(clients.admin, "admin_create_workstation_session", {
          p_business_id: identity.businessId,
          p_created_by_member_id: identity.memberId,
          p_token_hash: tokenHash,
          p_expires_at: workstationExpiresAt,
        }),
      );
      const operator = await issueOperator(
        workstationToken,
        identity.memberId,
        workstationExpiresAt,
        clients,
      );
      return { identity, workstationToken, workstationExpiresAt, ...operator };
    } catch {
      try {
        await revoke("admin_revoke_workstation_session", tokenHash, clients);
      } catch {
        throw new WorkstationSessionError("CLEANUP_PENDING");
      }
      throw new WorkstationSessionError("UNAVAILABLE");
    }
  });
}

/** @param {{workstationToken: string, username: string, password: string}} input @param {Clients} [dependencies] */
export async function activateMemberWithPassword(input, dependencies) {
  return sessionOperation(async () => {
    const clients = dependencies ?? createWorkstationClients();
    const station = await requireStation(input.workstationToken, clients);
    // No business ID/slug accepted from the browser on this flow.
    const identity = await authenticateMemberPassword(
      {
        businessSlug: station.businessSlug,
        username: input.username,
        password: input.password,
      },
      clients,
    );
    if (identity.businessId !== station.businessId)
      throw new WorkstationSessionError("INVALID_CREDENTIALS");
    await rpc(clients.admin, "admin_activate_workstation_member", {
      p_workstation_token_hash: hashSessionToken(input.workstationToken),
      p_member_id: identity.memberId,
    });
    return {
      identity,
      ...(await issueOperator(
        input.workstationToken,
        identity.memberId,
        station.expiresAt,
        clients,
      )),
    };
  });
}

/** @param {{workstationToken: string, memberId: string, pin: string}} input @param {Clients} [dependencies] */
export async function unlockOperatorWithPin(input, dependencies) {
  return sessionOperation(async () => {
    const clients = dependencies ?? createWorkstationClients();
    const station = await requireStation(input.workstationToken, clients);
    if (
      !isUuid(input.memberId) ||
      typeof input.pin !== "string" ||
      !/^[0-9]{4,6}$/.test(input.pin)
    )
      throw new WorkstationSessionError("INVALID_PIN");
    const rows = await rpc(clients.admin, "admin_resolve_workstation_member", {
      p_workstation_token_hash: hashSessionToken(input.workstationToken),
      p_member_id: input.memberId,
    });
    if (!rows?.[0]) throw new WorkstationSessionError("INVALID_PIN");
    const identity = safeIdentity(rows[0]);
    if (
      identity.businessId !== station.businessId ||
      identity.memberId !== input.memberId
    )
      throw new WorkstationSessionError("INVALID_PIN");
    // Separate RPC/transaction: false must commit its failed_attempts/locked_until.
    const verified = await rpc(clients.admin, "admin_verify_member_pin", {
      p_member_id: identity.memberId,
      p_pin: input.pin,
    });
    if (verified !== true) throw new WorkstationSessionError("INVALID_PIN");
    return {
      identity,
      ...(await issueOperator(
        input.workstationToken,
        identity.memberId,
        station.expiresAt,
        clients,
      )),
    };
  });
}

/** Require matching station/operator cookies; never accept an actor from payload.
 * @param {{workstationToken: string, operatorToken: string}} input @param {Clients} [dependencies]
 */
export async function resolveCurrentOperator(input, dependencies) {
  return sessionOperation(async () => {
    if (
      !isSessionToken(input.workstationToken) ||
      !isSessionToken(input.operatorToken)
    )
      return null;
    const clients = dependencies ?? createWorkstationClients();
    const station = await resolveStation(input.workstationToken, clients);
    if (!station) return null;
    const rows = await rpc(clients.admin, "admin_resolve_operator_session", {
      p_token_hash: hashSessionToken(input.operatorToken),
    });
    const row = rows?.[0];
    if (
      !row ||
      row.workstation_session_id !== station.id ||
      row.business_id !== station.businessId
    )
      return null;
    if (
      !(Date.parse(row.operator_expires_at) > Date.now()) ||
      !(Date.parse(row.workstation_expires_at) > Date.now())
    )
      return null;
    return {
      ...safeIdentity(row),
      operatorSessionId: safeString(row.operator_session_id),
      workstationSessionId: station.id,
      operatorExpiresAt: safeString(row.operator_expires_at),
      workstationExpiresAt: safeString(row.workstation_expires_at),
    };
  });
}

/** @param {{operatorToken: string}} input @param {Clients} [dependencies] */
export async function lockCurrentOperator(input, dependencies) {
  return sessionOperation(async () => {
    if (!isSessionToken(input.operatorToken)) return;
    await revoke(
      "admin_revoke_operator_session",
      hashSessionToken(input.operatorToken),
      dependencies ?? createWorkstationClients(),
    );
  });
}

/** @param {{workstationToken: string}} input @param {Clients} [dependencies] */
export async function closeWorkstation(input, dependencies) {
  return sessionOperation(async () => {
    if (!isSessionToken(input.workstationToken)) return;
    await revoke(
      "admin_revoke_workstation_session",
      hashSessionToken(input.workstationToken),
      dependencies ?? createWorkstationClients(),
    );
  });
}
