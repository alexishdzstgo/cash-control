// @ts-check
import "server-only";
import { createClient } from "@supabase/supabase-js";
import {
  findAuthUserByEmail,
  ProvisioningError,
  provisionExistingAuthMember,
  requiredText,
} from "../src/lib/users/server/provisioning.mjs";

function readOwnerInput(env) {
  const firstName = requiredText(
    env.OWNER_FIRST_NAME ?? "Zeferino",
    "OWNER_FIRST_NAME",
  );
  return {
    authEmail: requiredText(
      env.OWNER_AUTH_EMAIL ?? "zeferino@cashcontrol.com",
      "OWNER_AUTH_EMAIL",
    ),
    businessSlug: requiredText(
      env.OWNER_BUSINESS_SLUG ?? "cash-control",
      "OWNER_BUSINESS_SLUG",
    ),
    firstName,
    // profiles.last_name is required by the existing schema. The default keeps
    // the requested single-name profile while allowing a real surname override.
    lastName: requiredText(env.OWNER_LAST_NAME ?? firstName, "OWNER_LAST_NAME"),
    displayName: requiredText(
      env.OWNER_DISPLAY_NAME ?? firstName,
      "OWNER_DISPLAY_NAME",
    ),
    username: requiredText(env.OWNER_USERNAME ?? "zeferino", "OWNER_USERNAME"),
    pin: env.OWNER_PIN ?? "1234",
  };
}

try {
  const input = readOwnerInput(process.env);
  const url = requiredText(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    "NEXT_PUBLIC_SUPABASE_URL",
  );
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" &&
    !(
      parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(parsed.hostname)
    )
  ) {
    throw new ProvisioningError(
      "URL Supabase inválida; requiere HTTPS o localhost.",
    );
  }
  const key = requiredText(
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SECRET_KEY (o SUPABASE_SERVICE_ROLE_KEY)",
  );
  const admin = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const business = await admin
    .from("businesses")
    .select("id,status")
    .eq("slug", input.businessSlug)
    .maybeSingle();
  if (business.error || !business.data) {
    throw new ProvisioningError(
      "No existe un negocio con OWNER_BUSINESS_SLUG; no se creó ni modificó ninguna cuenta.",
    );
  }
  if (business.data.status !== "active") {
    throw new ProvisioningError("Se requiere un negocio activo.");
  }

  const authUser = await findAuthUserByEmail(admin, input.authEmail);
  const result = await provisionExistingAuthMember(
    {
      businessId: String(business.data.id),
      userId: authUser.id,
      firstName: input.firstName,
      lastName: input.lastName,
      displayName: input.displayName,
      username: input.username,
      role: "owner",
      pin: input.pin,
    },
    {
      admin,
      authorize: async (target) =>
        target.businessId === String(business.data.id) &&
        target.role === "owner",
    },
  );
  console.log(
    JSON.stringify({
      authEmail: input.authEmail,
      businessSlug: input.businessSlug,
      username: result.username,
      memberId: result.memberId,
      alreadyLinked: result.alreadyLinked,
    }),
  );
} catch (error) {
  console.error(
    error instanceof ProvisioningError
      ? error.message
      : "Provisioning fallido. Revisar configuración y estado antes de reintentar.",
  );
  process.exitCode = 1;
}
