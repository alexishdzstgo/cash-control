import "server-only";
import type { NextRequest } from "next/server";
import {
  readSessionCookies,
  setOperatorCookie,
} from "@/lib/workstation/server/cookies.mjs";
import { assertMutationOrigin } from "@/lib/workstation/server/csrf.mjs";
import { publicOperatorResponse } from "@/lib/workstation/server/responses.mjs";
import { activateMemberWithPassword } from "@/lib/workstation/server/sessions.mjs";
import { WorkstationSessionError } from "@/lib/workstation/server/shared.mjs";
import {
  errorResponse,
  invalidInputResponse,
  jsonResponse,
  readJsonObject,
  textField,
} from "../_shared";

export async function POST(request: NextRequest) {
  try {
    assertMutationOrigin(request);
  } catch (error) {
    return errorResponse(error);
  }

  const { workstationToken } = readSessionCookies(request);
  const body = await readJsonObject(request);
  const username = body && textField(body, "username");
  const password = body && textField(body, "password");
  if (!workstationToken) {
    return errorResponse(new WorkstationSessionError("INVALID_SESSION"));
  }
  if (!username || !password) return invalidInputResponse();

  try {
    const result = await activateMemberWithPassword({
      workstationToken,
      username,
      password,
    });
    const response = jsonResponse(publicOperatorResponse(result));
    return setOperatorCookie(response, result.operatorToken);
  } catch (error) {
    return errorResponse(error);
  }
}
