// @ts-check
import "server-only";
import { createClient } from "@supabase/supabase-js";
import {
  bootstrapFirstOwner,
  readBootstrapInput,
} from "../src/lib/users/server/bootstrap.mjs";
import {
  ProvisioningError,
  requiredText,
} from "../src/lib/users/server/provisioning.mjs";

try {
  // Validate everything before the first network call. No dotenv auto-loading.
  readBootstrapInput(process.env);
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
    process.env.SUPABASE_SECRET_KEY,
    "SUPABASE_SECRET_KEY",
  );
  const admin = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  const result = await bootstrapFirstOwner(admin, process.env);
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(
    error instanceof ProvisioningError
      ? error.message
      : "Bootstrap fallido. Revisar configuración y conectividad; no reintentar sin comprobar el estado.",
  );
  process.exitCode = 1;
}
