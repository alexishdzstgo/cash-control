import "server-only";
import type { NextRequest } from "next/server";
import {
  readSessionCookies,
  setOperatorCookie,
} from "@/lib/workstation/server/cookies.mjs";
import { assertMutationOrigin } from "@/lib/workstation/server/csrf.mjs";
import { publicOperatorResponse } from "@/lib/workstation/server/responses.mjs";
import { unlockOperatorWithPin } from "@/lib/workstation/server/sessions.mjs";
import {
  isUuid,
  WorkstationSessionError,
} from "@/lib/workstation/server/shared.mjs";
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
  const memberId = body && textField(body, "memberId");
  const pin = body && textField(body, "pin");
  if (!workstationToken) {
    return errorResponse(new WorkstationSessionError("INVALID_SESSION"));
  }
  if (!memberId || !isUuid(memberId) || !pin || !/^\d{4,6}$/.test(pin))
    return invalidInputResponse();

  try {
    const result = await unlockOperatorWithPin({
      workstationToken,
      memberId,
      pin,
    });
    const response = jsonResponse(publicOperatorResponse(result));
    return setOperatorCookie(response, result.operatorToken);
  } catch (error) {
    return errorResponse(error);
  }
}
