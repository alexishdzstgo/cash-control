import "server-only";
import type { NextRequest } from "next/server";
import { readSessionCookies } from "@/lib/workstation/server/cookies.mjs";
import { publicOperatorResponse } from "@/lib/workstation/server/responses.mjs";
import { resolveCurrentOperator } from "@/lib/workstation/server/sessions.mjs";
import { errorResponse, jsonResponse } from "../_shared";

export async function GET(request: NextRequest) {
  const { workstationToken, operatorToken } = readSessionCookies(request);
  if (!workstationToken)
    return jsonResponse({ state: "NO_WORKSTATION" as const });
  if (!operatorToken) return jsonResponse({ state: "NO_OPERATOR" as const });

  try {
    const operator = await resolveCurrentOperator({
      workstationToken,
      operatorToken,
    });
    if (!operator) return jsonResponse({ state: "INVALID_SESSION" as const });
    return jsonResponse({
      state: "ACTIVE" as const,
      operator: publicOperatorResponse(operator),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
