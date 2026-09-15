import "server-only";
import type { NextRequest } from "next/server";
import { transferShiftResponsibility } from "@/lib/shifts/server/shifts.mjs";
import {
  assertMutationOrigin,
  invalidInputResponse,
  jsonResponse,
  readJsonObject,
  readShiftSession,
  shiftErrorResponse,
  textField,
} from "../_shared";

export async function POST(request: NextRequest) {
  try {
    assertMutationOrigin(request);
  } catch (error) {
    return shiftErrorResponse(error);
  }

  const body = await readJsonObject(request);
  const memberId = body && textField(body, "p_new_responsible_member_id");
  if (
    !memberId ||
    Object.keys(body ?? {}).some((key) => key !== "p_new_responsible_member_id")
  )
    return invalidInputResponse();

  try {
    const session = readShiftSession(request);
    return jsonResponse({
      result: await transferShiftResponsibility({ ...session, memberId }),
    });
  } catch (error) {
    return shiftErrorResponse(error);
  }
}
