import "server-only";

import { createClient } from "@supabase/supabase-js";

// No singleton, user cookies or shared/client re-export. Not used by the UI.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error(
      "Supabase Admin no está configurado: define NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY únicamente en el servidor.",
    );
  }
  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
