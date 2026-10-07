import "server-only";
import type { NextRequest } from "next/server";
import { setSessionCookies } from "@/lib/workstation/server/cookies.mjs";
import { assertMutationOrigin } from "@/lib/workstation/server/csrf.mjs";
import { publicSessionResponse } from "@/lib/workstation/server/responses.mjs";
import { startWorkstationWithPin } from "@/lib/workstation/server/sessions.mjs";
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

  const body = await readJsonObject(request);
  const businessSlug = body && textField(body, "businessSlug");
  const username = body && textField(body, "username");
  const pin = body && textField(body, "pin");
  if (!businessSlug || !username || !pin || !/^\d{4,6}$/.test(pin))
    return invalidInputResponse();

  try {
    const result = await startWorkstationWithPin({
      businessSlug,
      username,
      pin,
    });
    const response = jsonResponse(publicSessionResponse(result));
    return setSessionCookies(response, result);
  } catch (error) {
    return errorResponse(error);
  }
}
