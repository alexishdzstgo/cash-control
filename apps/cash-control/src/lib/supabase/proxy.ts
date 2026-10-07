import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getPublicSupabaseConfig } from "./config";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = getPublicSupabaseConfig();
  // Phase 1 only: the prototype works without Supabase. Explicit client calls
  // still throw configuration errors; require configuration when Auth launches.
  if (!config) return response;

  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet)
          request.cookies.set(name, value);
        const previousCookies = response.cookies.getAll();
        const previousHeaders = new Headers(response.headers);
        response = NextResponse.next({ request });
        for (const cookie of previousCookies) response.cookies.set(cookie);
        // Preserve SDK cache-control headers across repeated refresh callbacks.
        for (const name of ["cache-control", "expires", "pragma"]) {
          const value = previousHeaders.get(name);
          if (value) response.headers.set(name, value);
        }
        for (const { name, value, options } of cookiesToSet)
          response.cookies.set(name, value, options);
        for (const [name, value] of Object.entries(headers ?? {}))
          response.headers.set(name, value);
      },
    },
  });
  // Verify/refresh using Auth, never trust the getSession() user for security.
  // Phase 1 intentionally has no redirects or authorization decisions here.
  await supabase.auth.getClaims();
  return response;
}
