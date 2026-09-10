// @ts-check
import "server-only";

const messages = {
  INVALID_CREDENTIALS: "No se pudieron verificar las credenciales.",
  INVALID_PIN: "No se pudo desbloquear con ese PIN.",
  INVALID_SESSION: "La sesión no está disponible.",
  UNAVAILABLE: "No se pudo completar la operación de sesión.",
  CLEANUP_PENDING:
    "No se pudo confirmar la revocación. Reintenta el bloqueo o cierre de sesión.",
};

export class WorkstationSessionError extends Error {
  /** @param {keyof typeof messages} code */
  constructor(code) {
    super(messages[code]);
    this.code = code;
  }
}

/** @param {unknown} value */
export function validText(value) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !value.includes("\0")
  );
}

/** @param {unknown} value */
export function isUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

/** @param {unknown} value */
export function safeString(value) {
  if (typeof value !== "string" || !value)
    throw new WorkstationSessionError("UNAVAILABLE");
  return value;
}

/** Strict projection: never spread rows or SDK responses into returned objects.
 * @param {Record<string, unknown>} row
 */
export function safeIdentity(row) {
  if (row.role !== "owner" && row.role !== "employee")
    throw new WorkstationSessionError("UNAVAILABLE");
  return {
    businessId: safeString(row.business_id),
    memberId: safeString(row.member_id),
    userId: safeString(row.user_id),
    username: safeString(row.username),
    role: row.role,
    displayName: safeString(row.display_name),
  };
}

/** Catch both returned SDK errors and thrown transport errors, without a cause.
 * @template T @param {() => Promise<T>} operation @returns {Promise<T>}
 */
export async function sessionOperation(operation) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof WorkstationSessionError) throw error;
    throw new WorkstationSessionError("UNAVAILABLE");
  }
}

/** @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {string} name @param {Record<string, unknown>} parameters
 */
export async function rpc(admin, name, parameters) {
  const result = await admin.rpc(name, parameters);
  if (result.error) throw new WorkstationSessionError("UNAVAILABLE");
  return result.data;
}
