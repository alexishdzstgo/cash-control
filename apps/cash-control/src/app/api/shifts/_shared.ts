import "server-only";
import type { NextRequest } from "next/server";
import { ShiftOperationError } from "@/lib/shifts/server/shifts.mjs";
import { readSessionCookies } from "@/lib/workstation/server/cookies.mjs";
import { assertMutationOrigin } from "@/lib/workstation/server/csrf.mjs";
import { WorkstationSessionError } from "@/lib/workstation/server/shared.mjs";
import {
  invalidInputResponse,
  jsonResponse,
  readJsonObject,
  textField,
  errorResponse as workstationErrorResponse,
} from "../workstation/_shared";

export {
  assertMutationOrigin,
  invalidInputResponse,
  jsonResponse,
  readJsonObject,
  textField,
};

export function readShiftSession(request: NextRequest) {
  const { workstationToken, operatorToken } = readSessionCookies(request);
  if (!workstationToken || !operatorToken)
    throw new WorkstationSessionError("INVALID_SESSION");
  return { workstationToken, operatorToken };
}

function statusForShiftError(code: string) {
  if (code === "NO_OPEN_SHIFT") return 404;
  if (code === "DUPLICATE_OPEN_SHIFT") return 409;
  if (
    code === "ACTIVE_SHIFT_MANAGER_REQUIRED" ||
    code === "RESPONSIBLE_CANNOT_LEAVE"
  )
    return 403;
  if (
    code === "INVALID_MEMBER" ||
    code === "TRANSFER_REQUIRES_ACTIVE_PARTICIPANT" ||
    code === "DIFFERENT_PARTICIPANT_REQUIRED"
  )
    return 400;
  return 503;
}

export function shiftErrorResponse(error: unknown) {
  if (error instanceof ShiftOperationError)
    return jsonResponse(
      { error: error.message, code: error.code },
      statusForShiftError(error.code),
    );
  return workstationErrorResponse(error);
}
