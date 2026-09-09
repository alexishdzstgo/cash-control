// @ts-check
import "server-only";
import { randomUUID } from "node:crypto";
import {
  createBusinessMember,
  ProvisioningError,
  requiredText,
  validateMemberInput,
} from "./provisioning.mjs";

/** @param {Record<string, string | undefined>} env */
export function readBootstrapInput(env) {
  const businessName = requiredText(
    env.BOOTSTRAP_BUSINESS_NAME,
    "BOOTSTRAP_BUSINESS_NAME",
  );
  const businessSlug = requiredText(
    env.BOOTSTRAP_BUSINESS_SLUG,
    "BOOTSTRAP_BUSINESS_SLUG",
  );
  const firstName = requiredText(
    env.BOOTSTRAP_OWNER_FIRST_NAME,
    "BOOTSTRAP_OWNER_FIRST_NAME",
  );
  const lastName = requiredText(
    env.BOOTSTRAP_OWNER_LAST_NAME,
    "BOOTSTRAP_OWNER_LAST_NAME",
  );
  const member = validateMemberInput({
    businessId: randomUUID(),
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`,
    username: requiredText(
      env.BOOTSTRAP_OWNER_USERNAME,
      "BOOTSTRAP_OWNER_USERNAME",
    ),
    role: "owner",
    password: env.BOOTSTRAP_OWNER_PASSWORD ?? "",
    pin: env.BOOTSTRAP_OWNER_PIN ?? "",
  });
  return { businessName, businessSlug, member };
}

/** @param {import('./provisioning.mjs').AdminClient} admin @param {string} id */
async function removeEmptyBusiness(admin, id) {
  const members = await admin
    .from("business_members")
    .select("id")
    .eq("business_id", id)
    .limit(1);
  if (members.error) throw new Error();
  if (members.data?.length) return;
  // The FK from memberships prevents deletion if another request just added one.
  const removed = await admin.from("businesses").delete().eq("id", id);
  if (removed.error && removed.error.code !== "23503") throw new Error();
}

/** @param {import('./provisioning.mjs').AdminClient} admin @param {Record<string, string | undefined>} env */
export async function bootstrapFirstOwner(admin, env) {
  const { businessName, businessSlug, member } = readBootstrapInput(env);
  const found = await admin
    .from("businesses")
    .select("id,status")
    .eq("slug", businessSlug)
    .maybeSingle();
  if (found.error)
    throw new ProvisioningError("No se pudo consultar el negocio.");
  let business = found.data;
  let createdBusinessId = null;
  if (!business) {
    const id = randomUUID();
    const inserted = await admin
      .from("businesses")
      .insert({ id, name: businessName, slug: businessSlug })
      .select("id,status")
      .single();
    if (inserted.error?.code === "23505") {
      // Concurrent bootstrap: reuse the winner, never claim ownership for cleanup.
      const winner = await admin
        .from("businesses")
        .select("id,status")
        .eq("slug", businessSlug)
        .single();
      if (winner.error)
        throw new ProvisioningError(
          "No se pudo resolver el negocio existente.",
        );
      business = winner.data;
    } else if (inserted.error || !inserted.data) {
      throw new ProvisioningError(
        `No se confirmó el negocio. Revisar business_id=${id} antes de reintentar.`,
      );
    } else {
      business = inserted.data;
      createdBusinessId = id;
    }
  }
  if (!business || business.status !== "active")
    throw new ProvisioningError("Se requiere un negocio activo.");
  const businessId = String(business.id);
  try {
    return await createBusinessMember(
      { ...member, businessId },
      {
        admin,
        // CLI only: explicit operator authority, not a selectedUserId from UI.
        authorize: async (target) =>
          target.businessId === businessId && target.role === "owner",
      },
    );
  } catch (error) {
    const message =
      error instanceof ProvisioningError
        ? error.message
        : "Bootstrap fallido; revisar el estado antes de reintentar.";
    if (createdBusinessId) {
      try {
        await removeEmptyBusiness(admin, createdBusinessId);
      } catch {
        throw new ProvisioningError(
          `${message} Revisar limpieza business_id=${createdBusinessId}.`,
        );
      }
    }
    throw new ProvisioningError(message);
  }
}
