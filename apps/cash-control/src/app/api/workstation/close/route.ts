import "server-only";
import type { NextRequest } from "next/server";
import {
  clearSessionCookies,
  readSessionCookies,
} from "@/lib/workstation/server/cookies.mjs";
import { assertMutationOrigin } from "@/lib/workstation/server/csrf.mjs";
import { closeWorkstation } from "@/lib/workstation/server/sessions.mjs";
import { errorResponse, jsonResponse } from "../_shared";

export async function POST(request: NextRequest) {
  try {
    assertMutationOrigin(request);
  } catch (error) {
    return errorResponse(error);
  }

  const { workstationToken } = readSessionCookies(request);
  try {
    await closeWorkstation({ workstationToken: workstationToken ?? "" });
    const response = jsonResponse({ ok: true });
    return clearSessionCookies(response);
  } catch (error) {
    return errorResponse(error);
  }
}
