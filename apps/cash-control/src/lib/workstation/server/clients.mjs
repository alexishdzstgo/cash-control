// @ts-check
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { WorkstationSessionError } from "./shared.mjs";

/** @typedef {{admin: import('@supabase/supabase-js').SupabaseClient,
 * createPasswordClient: () => import('@supabase/supabase-js').SupabaseClient}} WorkstationClients */

/** Separate stateless clients; the password client is NEW for every attempt.
 * @param {Record<string, string | undefined>} env
 * @param {typeof createClient} factory
 * @returns {WorkstationClients}
 */
export function createWorkstationClients(
  env = process.env,
  factory = createClient,
) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = env.SUPABASE_SECRET_KEY;
  const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !secretKey || !publishableKey)
    throw new WorkstationSessionError("UNAVAILABLE");
  const options = () => ({
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return {
    admin: factory(url, secretKey, options()),
    createPasswordClient: () => factory(url, publishableKey, options()),
  };
}
