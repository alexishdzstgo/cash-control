import "server-only";
import type { NextRequest } from "next/server";
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
    void memberId;
    void session;
    return jsonResponse(
      {
        error:
          "La transferencia persistida requiere validación del PIN del receptor en una fase posterior.",
        code: "TRANSFER_PIN_UNSUPPORTED",
      },
      501,
    );
  } catch (error) {
    return shiftErrorResponse(error);
  }
}
