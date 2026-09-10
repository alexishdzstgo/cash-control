// @ts-check
import "server-only";
import { randomUUID } from "node:crypto";

/** @typedef {import('@supabase/supabase-js').SupabaseClient} AdminClient */
/**
 * Secrets are transient server inputs, never a browser DTO or mock UserAccount.
 * @typedef {{ businessId: string, firstName: string, lastName: string,
 * displayName: string, username: string, role: 'owner' | 'employee',
 * password: string, pin: string, avatar?: Record<string, unknown> | null,
 * internalNotes?: string }} MemberInput
 * @typedef {{ businessId: string, role: 'owner' | 'employee' }} AuthorizationTarget
 * @typedef {{ admin: AdminClient,
 * authorize: (target: AuthorizationTarget) => Promise<boolean> }} ServerAccess
 */

// Only these controlled errors may be printed. Never attach SDK errors/causes:
// PostgreSQL error details can contain whole rows and request values.
export class ProvisioningError extends Error {}

/** @param {unknown} value @param {string} name */
export function requiredText(value, name) {
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) {
    throw new ProvisioningError(`Entrada inválida: ${name}.`);
  }
  return value.trim();
}

/** @param {MemberInput} input */
export function validateMemberInput(input) {
  const firstName = requiredText(input.firstName, "firstName");
  const lastName = requiredText(input.lastName, "lastName");
  const displayName = requiredText(input.displayName, "displayName");
  const username = requiredText(input.username, "username");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      input.businessId,
    )
  ) {
    throw new ProvisioningError("businessId inválido.");
  }
  if (input.role !== "owner" && input.role !== "employee") {
    throw new ProvisioningError("Rol inválido.");
  }
  if (
    typeof input.password !== "string" ||
    input.password.length < 12 ||
    !input.password.trim() ||
    input.password.includes("\0")
  ) {
    throw new ProvisioningError(
      "La contraseña debe tener al menos 12 caracteres.",
    );
  }
  if (typeof input.pin !== "string" || !/^[0-9]{4,6}$/.test(input.pin)) {
    throw new ProvisioningError("El PIN debe tener entre 4 y 6 dígitos.");
  }
  const internalNotes = input.internalNotes ?? "";
  if (typeof internalNotes !== "string" || internalNotes.includes("\0")) {
    throw new ProvisioningError("Notas inválidas.");
  }
  const avatar = input.avatar ?? null;
  if (
    avatar !== null &&
    (typeof avatar !== "object" || Array.isArray(avatar))
  ) {
    throw new ProvisioningError("Avatar inválido.");
  }
  try {
    JSON.stringify(avatar);
  } catch {
    throw new ProvisioningError("Avatar no serializable.");
  }
  return {
    ...input,
    firstName,
    lastName,
    displayName,
    username,
    internalNotes,
    avatar,
  };
}

/**
 * No default authorization and no public endpoint. Future callers must use
 * resolveCurrentOperator server-side and authorize its membership/business/owner
 * role, never a selectedUserId or stale Supabase identity from the browser.
 * The CLI's authority comes from its operator-held backend Secret Key.
 * @param {MemberInput} rawInput @param {ServerAccess} access
 */
export async function createBusinessMember(rawInput, { admin, authorize }) {
  const input = validateMemberInput(rawInput);
  if (
    typeof authorize !== "function" ||
    !(await authorize({ businessId: input.businessId, role: input.role }))
  ) {
    throw new ProvisioningError("Actor no autorizado.");
  }
  const existing = await admin.rpc("admin_find_member_by_username", {
    p_business_id: input.businessId,
    p_username: input.username,
  });
  if (existing.error)
    throw new ProvisioningError(
      "No se pudo comprobar el username; verifica la migración 0002.",
    );
  if (existing.data)
    throw new ProvisioningError(
      "El username ya existe en este negocio; no se modificó la cuenta.",
    );

  const userId = randomUUID();
  // Never expose this address, put it in public tables or use it for recovery.
  let created;
  try {
    created = await admin.auth.admin.createUser({
      id: userId,
      email: `member-${userId}@example.com`,
      password: input.password,
      email_confirm: true,
    });
  } catch {
    throw new ProvisioningError(
      `Resultado Auth incierto. Revisar user_id=${userId} antes de reintentar.`,
    );
  }
  if (created.error || created.data.user?.id !== userId) {
    // A transport failure may follow a successful Auth commit. Do not delete
    // an unconfirmed identity; report only the generated ID for reconciliation.
    throw new ProvisioningError(
      `Auth no confirmó la creación. Revisar user_id=${userId} antes de reintentar.`,
    );
  }

  try {
    const provisioned = await admin.rpc("admin_provision_member", {
      p_business_id: input.businessId,
      p_user_id: userId,
      p_first_name: input.firstName,
      p_last_name: input.lastName,
      p_display_name: input.displayName,
      p_avatar: input.avatar,
      p_username: input.username,
      p_role: input.role,
      p_internal_notes: input.internalNotes,
      p_pin: input.pin,
    });
    if (provisioned.error || typeof provisioned.data !== "string")
      throw new Error();
    return {
      businessId: input.businessId,
      userId,
      memberId: provisioned.data,
      username: input.username,
    };
  } catch {
    // Recover a committed RPC whose response was lost before compensating.
    try {
      const committed = await admin
        .from("business_members")
        .select("id")
        .eq("business_id", input.businessId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!committed.error && committed.data) {
        return {
          businessId: input.businessId,
          userId,
          memberId: String(committed.data.id),
          username: input.username,
        };
      }
    } catch {
      /* Best-effort reconciliation; FK also prevents deleting a provisioned Auth user. */
    }
    try {
      const removed = await admin.auth.admin.deleteUser(userId);
      if (removed.error) throw new Error();
    } catch {
      throw new ProvisioningError(
        `Aprovisionamiento fallido; compensación pendiente. Revisar user_id=${userId}.`,
      );
    }
    throw new ProvisioningError(
      "Aprovisionamiento fallido; Auth user nuevo eliminado.",
    );
  }
}
