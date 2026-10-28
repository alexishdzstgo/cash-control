import { NextResponse } from "next/server";
import { OWNER_SESSION_COOKIE } from "@/lib/api-v2/server/auth";
import type { V2ApiResponse } from "@/lib/api-v2/types";

export async function POST(): Promise<
  NextResponse<V2ApiResponse<{ loggedOut: boolean }>>
> {
  const response = NextResponse.json(
    {
      ok: true as const,
      data: { loggedOut: true },
    },
    { status: 200 },
  );

  response.cookies.set({
    name: OWNER_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
