import "server-only";
import type { NextRequest } from "next/server";
import {
  clearOperatorCookie,
  readSessionCookies,
} from "@/lib/workstation/server/cookies.mjs";
import { assertMutationOrigin } from "@/lib/workstation/server/csrf.mjs";
import { lockCurrentOperator } from "@/lib/workstation/server/sessions.mjs";
import { errorResponse, jsonResponse } from "../_shared";

export async function POST(request: NextRequest) {
  try {
    assertMutationOrigin(request);
  } catch (error) {
    return errorResponse(error);
  }

  const { operatorToken } = readSessionCookies(request);
  try {
    await lockCurrentOperator({ operatorToken: operatorToken ?? "" });
    const response = jsonResponse({ ok: true });
    return clearOperatorCookie(response);
  } catch (error) {
    return errorResponse(error);
  }
}
