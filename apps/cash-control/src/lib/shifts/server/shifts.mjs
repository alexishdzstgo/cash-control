// @ts-check
import "server-only";
import { createWorkstationClients } from "../../workstation/server/clients.mjs";
import { resolveCurrentOperator } from "../../workstation/server/sessions.mjs";
import {
  isUuid,
  rpc,
  safeString,
  WorkstationSessionError,
} from "../../workstation/server/shared.mjs";
import {
  hashSessionToken,
  isSessionToken,
} from "../../workstation/server/tokens.mjs";

/** @typedef {import('@supabase/supabase-js').SupabaseClient} SupabaseClient */
/** @typedef {{admin: SupabaseClient, createPasswordClient: () => SupabaseClient}} Clients */
/** @typedef {{workstationToken: string, operatorToken: string}} SessionInput */

/** @param {unknown} value */
function safeStatus(value) {
  if (value !== "open" && value !== "closed")
    throw new WorkstationSessionError("UNAVAILABLE");
  return value;
}

/** @param {unknown} value */
function safeParticipantRole(value) {
  if (value !== "shift_responsible" && value !== "operator")
    throw new WorkstationSessionError("UNAVAILABLE");
  return value;
}

/** @param {unknown} value */
function safeParticipantStatus(value) {
  if (value !== "active" && value !== "left")
    throw new WorkstationSessionError("UNAVAILABLE");
  return value;
}

/** @param {unknown} value */
function safeNullableString(value) {
  if (value === null) return null;
  return safeString(value);
}

/** @param {Record<string, unknown>} row */
function safeShift(row) {
  return {
    id: safeString(row.shift_id),
    folio: safeString(row.folio),
    status: safeStatus(row.status),
    openedAt: safeString(row.opened_at),
    responsibleMemberId: safeString(row.responsible_member_id),
  };
}

/** @param {Record<string, unknown>} row */
function safeParticipant(row) {
  return {
    memberId: safeString(row.member_id),
    role: safeParticipantRole(row.role),
    status: safeParticipantStatus(row.status),
    joinedAt: safeString(row.joined_at),
    leftAt: safeNullableString(row.left_at),
  };
}

/** @param {Record<string, unknown>} row */
function safeListedParticipant(row) {
  return {
    ...safeParticipant(row),
    username: safeString(row.username),
    displayName: safeString(row.display_name),
  };
}

/** @param {SessionInput} input @param {Clients} clients */
async function requireActor(input, clients) {
  if (
    !isSessionToken(input.workstationToken) ||
    !isSessionToken(input.operatorToken)
  )
    throw new WorkstationSessionError("INVALID_SESSION");

  const actor = await resolveCurrentOperator(
    {
      workstationToken: input.workstationToken,
      operatorToken: input.operatorToken,
    },
    clients,
  );
  if (!actor) throw new WorkstationSessionError("INVALID_SESSION");
  return actor;
}

/** @param {SessionInput} input @param {(clients: Clients, hash: string) => Promise<unknown>} operation @param {Clients} [dependencies] */
async function withActor(input, operation, dependencies) {
  try {
    const clients = dependencies ?? createWorkstationClients();
    await requireActor(input, clients);
    return await operation(clients, hashSessionToken(input.operatorToken));
  } catch (error) {
    if (error instanceof WorkstationSessionError) throw error;
    throw new WorkstationSessionError("UNAVAILABLE");
  }
}

/** @param {SessionInput} input @param {Clients} [dependencies] */
export async function openShift(input, dependencies) {
  return withActor(
    input,
    async (clients, operatorTokenHash) => {
      const rows = await rpc(clients.admin, "admin_open_shift", {
        p_operator_token_hash: operatorTokenHash,
      });
      if (!Array.isArray(rows) || !rows[0])
        throw new WorkstationSessionError("UNAVAILABLE");
      return safeShift(rows[0]);
    },
    dependencies,
  );
}

/** @param {SessionInput & {memberId: string}} input @param {Clients} [dependencies] */
export async function addShiftParticipant(input, dependencies) {
  if (!isUuid(input.memberId))
    throw new WorkstationSessionError("INVALID_SESSION");
  return withActor(
    input,
    async (clients, operatorTokenHash) => {
      const rows = await rpc(clients.admin, "admin_add_shift_participant", {
        p_operator_token_hash: operatorTokenHash,
        p_member_id: input.memberId,
      });
      if (!Array.isArray(rows) || !rows[0])
        throw new WorkstationSessionError("UNAVAILABLE");
      return safeParticipant(rows[0]);
    },
    dependencies,
  );
}

/** @param {SessionInput} input @param {Clients} [dependencies] */
export async function leaveShift(input, dependencies) {
  return withActor(
    input,
    async (clients, operatorTokenHash) => {
      const rows = await rpc(clients.admin, "admin_leave_shift", {
        p_operator_token_hash: operatorTokenHash,
      });
      if (!Array.isArray(rows) || !rows[0])
        throw new WorkstationSessionError("UNAVAILABLE");
      return safeParticipant(rows[0]);
    },
    dependencies,
  );
}

/** @param {SessionInput & {memberId: string}} input @param {Clients} [dependencies] */
export async function transferShiftResponsibility(input, dependencies) {
  if (!isUuid(input.memberId))
    throw new WorkstationSessionError("INVALID_SESSION");
  return withActor(
    input,
    async (clients, operatorTokenHash) => {
      const rows = await rpc(
        clients.admin,
        "admin_transfer_shift_responsibility",
        {
          p_operator_token_hash: operatorTokenHash,
          p_new_responsible_member_id: input.memberId,
        },
      );
      const row = Array.isArray(rows) && rows[0];
      if (!row) throw new WorkstationSessionError("UNAVAILABLE");
      return {
        shiftId: safeString(row.shift_id),
        previousResponsibleMemberId: safeString(
          row.previous_responsible_member_id,
        ),
        responsibleMemberId: safeString(row.responsible_member_id),
      };
    },
    dependencies,
  );
}

/** @param {SessionInput} input @param {Clients} [dependencies] */
export async function resolveOpenShift(input, dependencies) {
  return withActor(
    input,
    async (clients, operatorTokenHash) => {
      const rows = await rpc(clients.admin, "admin_resolve_open_shift", {
        p_operator_token_hash: operatorTokenHash,
      });
      if (!Array.isArray(rows))
        throw new WorkstationSessionError("UNAVAILABLE");
      return rows[0] ? safeShift(rows[0]) : null;
    },
    dependencies,
  );
}

/** @param {SessionInput} input @param {Clients} [dependencies] */
export async function listShiftParticipants(input, dependencies) {
  return withActor(
    input,
    async (clients, operatorTokenHash) => {
      const rows = await rpc(clients.admin, "admin_list_shift_participants", {
        p_operator_token_hash: operatorTokenHash,
      });
      if (!Array.isArray(rows))
        throw new WorkstationSessionError("UNAVAILABLE");
      return rows.map(safeListedParticipant);
    },
    dependencies,
  );
}
