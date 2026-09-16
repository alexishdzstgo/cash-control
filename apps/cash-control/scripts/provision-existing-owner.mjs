// @ts-check
import "server-only";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import {
  findAuthUserByEmail,
  ProvisioningError,
  provisionExistingAuthMember,
  requiredText,
} from "../src/lib/users/server/provisioning.mjs";

const DEFAULT_OWNER_BUSINESS_SLUG = "cash-control";
const { loadEnvConfig } = nextEnv;

// npm does not load Next.js env files for standalone Node scripts. Use the
// same loader as the application before reading any server credentials.
loadEnvConfig(fileURLToPath(new URL("..", import.meta.url)), true, true);

function readBusinessSlug(env) {
  const configured = env.OWNER_BUSINESS_SLUG?.trim();
  // Ignore copied placeholder labels such as OWNER\_BUSINESS\_SLUG. They are
  // not valid data and must not override the real project default.
  if (
    !configured ||
    configured === "OWNER_BUSINESS_SLUG" ||
    configured === "OWNER\\_BUSINESS\\_SLUG"
  ) {
    return DEFAULT_OWNER_BUSINESS_SLUG;
  }
  return configured;
}

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
    businessSlug: requiredText(readBusinessSlug(env), "OWNER_BUSINESS_SLUG"),
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
  if (business.error) {
    throw new ProvisioningError(
      `No se pudo consultar el negocio con slug "${input.businessSlug}" en Supabase; no se creó ni modificó ninguna cuenta.`,
    );
  }
  if (!business.data) {
    throw new ProvisioningError(
      `No existe un negocio con slug "${input.businessSlug}"; no se creó ni modificó ninguna cuenta.`,
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
