import { NextResponse } from "next/server";
import { getAuthenticatedOwner } from "@/lib/api-v2/server/auth";
import { executeV2Rpc } from "@/lib/api-v2/server/db";
import type {
  JoinShiftParams,
  JoinShiftResult,
  V2ApiResponse,
} from "@/lib/api-v2/types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
): Promise<NextResponse<V2ApiResponse<JoinShiftResult>>> {
  try {
    // 1. Verificación obligatoria de autenticación en el servidor
    const ownerSession = await getAuthenticatedOwner(request);
    if (!ownerSession) {
      return NextResponse.json(
        {
          ok: false,
          code: "UNAUTHORIZED",
          message:
            "No autenticado. Se requiere una sesión válida en el servidor para relevar turnos.",
        },
        { status: 401 },
      );
    }

    const body = (await request.json()) as Partial<JoinShiftParams>;

    const { businessId, workstationId, operatorMemberId, pin } = body;

    // Validación de entrada en el servidor
    if (!businessId || !UUID_REGEX.test(businessId)) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message: "businessId debe ser un UUID válido.",
        },
        { status: 400 },
      );
    }

    // 2. Control estricto de pertenencia multi-inquilino
    if (ownerSession.businessId !== businessId) {
      return NextResponse.json(
        {
          ok: false,
          code: "FORBIDDEN_BUSINESS_ACCESS",
          message:
            "El usuario autenticado no tiene autorización sobre esta empresa.",
        },
        { status: 403 },
      );
    }

    if (!workstationId || !UUID_REGEX.test(workstationId)) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message: "workstationId debe ser un UUID válido.",
        },
        { status: 400 },
      );
    }

    if (!operatorMemberId || !UUID_REGEX.test(operatorMemberId)) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message: "operatorMemberId debe ser un UUID válido.",
        },
        { status: 400 },
      );
    }

    if (!pin || typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message: "El PIN debe ser exactamente de 4 dígitos numéricos.",
        },
        { status: 400 },
      );
    }

    // Invocación RPC v2
    const result = await executeV2Rpc<JoinShiftResult>("rpc_join_shift", [
      businessId,
      workstationId,
      operatorMemberId,
      pin,
    ]);

    if (!result.ok) {
      const statusCode =
        result.code === "INVALID_OPERATOR_PIN"
          ? 401
          : result.code === "NO_OPEN_SHIFT"
            ? 409
            : 400;

      return NextResponse.json(result, { status: statusCode });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Error interno procesando incorporación al turno.";
    return NextResponse.json(
      {
        ok: false,
        code: "INTERNAL_SERVER_ERROR",
        message,
        details: { raw: String(error) },
      },
      { status: 500 },
    );
  }
}
