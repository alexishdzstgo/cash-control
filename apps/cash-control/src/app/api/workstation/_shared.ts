import "server-only";
import { type NextRequest, NextResponse } from "next/server";
import { OriginValidationError } from "@/lib/workstation/server/csrf.mjs";
import { WorkstationSessionError } from "@/lib/workstation/server/shared.mjs";

const GENERIC_ERROR = "No se pudo completar la operación de sesión.";

export async function readJsonObject(
  request: NextRequest,
): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function textField(
  body: Record<string, unknown>,
  name: string,
): string | null {
  const value = body[name];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function errorResponse(error: unknown) {
  if (error instanceof OriginValidationError)
    return jsonResponse(
      { error: "Solicitud rechazada." },
      error.code === "MISSING_APP_ORIGIN" || error.code === "INVALID_APP_ORIGIN"
        ? 503
        : 403,
    );

  if (error instanceof WorkstationSessionError) {
    const status =
      error.code === "INVALID_CREDENTIALS" ||
      error.code === "INVALID_PIN" ||
      error.code === "INVALID_SESSION"
        ? 401
        : 503;
    return jsonResponse({ error: error.message }, status);
  }

  return jsonResponse({ error: GENERIC_ERROR }, 503);
}

export function invalidInputResponse() {
  return jsonResponse({ error: "Solicitud inválida." }, 400);
}
