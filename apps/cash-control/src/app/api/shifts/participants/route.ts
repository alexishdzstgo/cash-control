import "server-only";
import type { NextRequest } from "next/server";
import {
  addShiftParticipant,
  listShiftParticipants,
} from "@/lib/shifts/server/shifts.mjs";
import {
  assertMutationOrigin,
  invalidInputResponse,
  jsonResponse,
  readJsonObject,
  readShiftSession,
  shiftErrorResponse,
  textField,
} from "../_shared";

export async function GET(request: NextRequest) {
  try {
    const session = readShiftSession(request);
    return jsonResponse({ participants: await listShiftParticipants(session) });
  } catch (error) {
    return shiftErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertMutationOrigin(request);
  } catch (error) {
    return shiftErrorResponse(error);
  }

  const body = await readJsonObject(request);
  const memberId = body && textField(body, "memberId");
  if (!memberId || Object.keys(body ?? {}).some((key) => key !== "memberId"))
    return invalidInputResponse();

  try {
    const session = readShiftSession(request);
    return jsonResponse(
      { participant: await addShiftParticipant({ ...session, memberId }) },
      201,
    );
  } catch (error) {
    return shiftErrorResponse(error);
  }
}
