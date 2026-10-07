import "server-only";
import type { NextRequest } from "next/server";
import { transferShiftResponsibility } from "@/lib/shifts/server/shifts.mjs";
import { isUuid } from "@/lib/workstation/server/shared.mjs";
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
  const receiverPin = body && textField(body, "receiverPin");
  if (
    !memberId ||
    !isUuid(memberId) ||
    !receiverPin ||
    !/^[0-9]{4,6}$/.test(receiverPin) ||
    Object.keys(body ?? {}).some(
      (key) => key !== "p_new_responsible_member_id" && key !== "receiverPin",
    )
  )
    return invalidInputResponse();

  try {
    const session = readShiftSession(request);
    return jsonResponse({
      result: await transferShiftResponsibility({
        ...session,
        memberId,
        receiverPin,
      }),
    });
  } catch (error) {
    return shiftErrorResponse(error);
  }
}
