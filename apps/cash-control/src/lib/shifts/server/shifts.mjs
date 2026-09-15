// @ts-check
import "server-only";
import { createWorkstationClients } from "../../workstation/server/clients.mjs";
import { resolveCurrentOperator } from "../../workstation/server/sessions.mjs";
import {
  isUuid,
  safeString,
  WorkstationSessionError,
} from "../../workstation/server/shared.mjs";
import {
  hashSessionToken,
  isSessionToken,
} from "../../workstation/server/tokens.mjs";

const shiftErrorMessages = {
  DUPLICATE_OPEN_SHIFT: "Ya existe un turno abierto para este negocio.",
  NO_OPEN_SHIFT: "No existe un turno abierto.",
  INVALID_MEMBER: "El participante no es válido para este negocio.",
  ACTIVE_SHIFT_MANAGER_REQUIRED:
    "Solo el responsable activo o el propietario puede administrar participantes.",
  ACTIVE_PARTICIPATION_REQUIRED:
    "Necesitas una participación activa en el turno.",
  RESPONSIBLE_CANNOT_LEAVE:
    "El responsable no puede salir del turno. Primero transfiere la responsabilidad.",
  TRANSFER_REQUIRES_ACTIVE_PARTICIPANT:
    "La responsabilidad solo puede transferirse a un participante activo.",
  DIFFERENT_PARTICIPANT_REQUIRED:
    "Selecciona un participante distinto para transferir la responsabilidad.",
};

/** @typedef {keyof typeof shiftErrorMessages} ShiftErrorCode */

export class ShiftOperationError extends Error {
  /** @param {ShiftErrorCode} code */
  constructor(code) {
    super(shiftErrorMessages[code]);
    this.name = "ShiftOperationError";
    this.code = code;
  }
}

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
    if (
      error instanceof WorkstationSessionError ||
      error instanceof ShiftOperationError
    )
      throw error;
    throw new WorkstationSessionError("UNAVAILABLE");
  }
}

/** @param {unknown} error */
function mapShiftRpcError(error) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "";
  const normalized = message.toLowerCase();

  if (normalized.includes("open shift already exists"))
    return new ShiftOperationError("DUPLICATE_OPEN_SHIFT");
  if (normalized.includes("open shift required"))
    return new ShiftOperationError("NO_OPEN_SHIFT");
  if (normalized.includes("active member of this business"))
    return new ShiftOperationError("INVALID_MEMBER");
  if (normalized.includes("active shift manager required"))
    return new ShiftOperationError("ACTIVE_SHIFT_MANAGER_REQUIRED");
  if (normalized.includes("active shift participation required"))
    return new ShiftOperationError("ACTIVE_PARTICIPATION_REQUIRED");
  if (normalized.includes("transfer responsibility before leaving"))
    return new ShiftOperationError("RESPONSIBLE_CANNOT_LEAVE");
  if (normalized.includes("new responsible must be an active participant"))
    return new ShiftOperationError("TRANSFER_REQUIRES_ACTIVE_PARTICIPANT");
  if (normalized.includes("different active participant is required"))
    return new ShiftOperationError("DIFFERENT_PARTICIPANT_REQUIRED");

  return null;
}

/** @param {SupabaseClient} admin @param {string} name @param {Record<string, unknown>} parameters */
async function shiftRpc(admin, name, parameters) {
  const result = await admin.rpc(name, parameters);
  if (result.error) throw mapShiftRpcError(result.error) ?? result.error;
  return result.data;
}

/** @param {SessionInput} input @param {Clients} [dependencies] */
export async function openShift(input, dependencies) {
  return withActor(
    input,
    async (clients, operatorTokenHash) => {
      const rows = await shiftRpc(clients.admin, "admin_open_shift", {
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
      const rows = await shiftRpc(
        clients.admin,
        "admin_add_shift_participant",
        {
          p_operator_token_hash: operatorTokenHash,
          p_member_id: input.memberId,
        },
      );
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
      const rows = await shiftRpc(clients.admin, "admin_leave_shift", {
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
      const rows = await shiftRpc(
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
      const rows = await shiftRpc(clients.admin, "admin_resolve_open_shift", {
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
      const rows = await shiftRpc(
        clients.admin,
        "admin_list_shift_participants",
        {
          p_operator_token_hash: operatorTokenHash,
        },
      );
      if (!Array.isArray(rows))
        throw new WorkstationSessionError("UNAVAILABLE");
      return rows.map(safeListedParticipant);
    },
    dependencies,
  );
}
