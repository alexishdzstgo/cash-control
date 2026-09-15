import "server-only";
import type { NextRequest } from "next/server";
import {
  listShiftParticipants,
  openShift,
  resolveOpenShift,
} from "@/lib/shifts/server/shifts.mjs";
import {
  assertMutationOrigin,
  jsonResponse,
  readShiftSession,
  shiftErrorResponse,
} from "./_shared";

export async function GET(request: NextRequest) {
  try {
    const session = readShiftSession(request);
    const [shift, participants] = await Promise.all([
      resolveOpenShift(session),
      listShiftParticipants(session),
    ]);
    return jsonResponse({ shift, participants });
  } catch (error) {
    return shiftErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertMutationOrigin(request);
    const session = readShiftSession(request);
    return jsonResponse({ shift: await openShift(session) }, 201);
  } catch (error) {
    return shiftErrorResponse(error);
  }
}
