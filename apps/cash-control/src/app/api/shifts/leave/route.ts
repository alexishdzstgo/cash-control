import "server-only";
import type { NextRequest } from "next/server";
import { leaveShift } from "@/lib/shifts/server/shifts.mjs";
import {
  assertMutationOrigin,
  jsonResponse,
  readShiftSession,
  shiftErrorResponse,
} from "../_shared";

export async function POST(request: NextRequest) {
  try {
    assertMutationOrigin(request);
    const session = readShiftSession(request);
    return jsonResponse({ participant: await leaveShift(session) });
  } catch (error) {
    return shiftErrorResponse(error);
  }
}
