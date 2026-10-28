import { NextResponse } from "next/server";
import { getAuthenticatedOwner } from "@/lib/api-v2/server/auth";
import { executeV2Rpc } from "@/lib/api-v2/server/db";
import type {
  CorrectOperationParams,
  CorrectOperationResult,
  V2ApiResponse,
} from "@/lib/api-v2/types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
): Promise<NextResponse<V2ApiResponse<CorrectOperationResult>>> {
  try {
    // 1. Verificación opcional/previa de sesión de dueño autenticado
    const ownerSession = await getAuthenticatedOwner(request);

    const body = (await request.json()) as Partial<CorrectOperationParams>;

    const {
      businessId,
      workstationId,
      idempotencyKey,
      originalOperationId,
      reason,
      replacementAmountCents,
      replacementSourceResourceId,
      replacementDestinationResourceId,
      replacementSenderName,
      replacementReceiverName,
      sessionToken: bodyToken,
      operatorMemberId,
      operatorPin,
      replacementCustomerAccountRef,
      replacementBankFolio,
      replacementCommissionOverrideCents,
      supervisorPin,
      supervisorMemberId,
    } = body;

    // Token operativo de terminal: priorizar cabecera x-terminal-session
    const headerToken = request.headers.get("x-terminal-session");
    const sessionToken = headerToken || bodyToken || null;

    // 2. Validaciones de entrada en el servidor
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

    // Control multi-inquilino si el dueño está autenticado
    if (ownerSession && ownerSession.businessId !== businessId) {
      return NextResponse.json(
        {
          ok: false,
          code: "FORBIDDEN_BUSINESS_ACCESS",
          message:
            "El dueño autenticado no tiene autorización sobre esta empresa.",
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

    if (
      !idempotencyKey ||
      typeof idempotencyKey !== "string" ||
      !idempotencyKey.trim()
    ) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message: "idempotencyKey debe ser una cadena no vacía.",
        },
        { status: 400 },
      );
    }

    if (!originalOperationId || !UUID_REGEX.test(originalOperationId)) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message: "originalOperationId debe ser un UUID válido.",
        },
        { status: 400 },
      );
    }

    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message: "reason (motivo de la corrección) no puede estar vacío.",
        },
        { status: 400 },
      );
    }

    if (
      typeof replacementAmountCents !== "number" ||
      !Number.isInteger(replacementAmountCents) ||
      replacementAmountCents <= 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_AMOUNT",
          message:
            "replacementAmountCents debe ser un entero positivo mayor a cero.",
        },
        { status: 400 },
      );
    }

    if (
      !replacementSourceResourceId ||
      !UUID_REGEX.test(replacementSourceResourceId)
    ) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message: "replacementSourceResourceId debe ser un UUID válido.",
        },
        { status: 400 },
      );
    }

    if (
      !replacementDestinationResourceId ||
      !UUID_REGEX.test(replacementDestinationResourceId)
    ) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message: "replacementDestinationResourceId debe ser un UUID válido.",
        },
        { status: 400 },
      );
    }

    if (replacementSourceResourceId === replacementDestinationResourceId) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message:
            "replacementSourceResourceId y replacementDestinationResourceId deben ser distintos.",
        },
        { status: 400 },
      );
    }

    if (
      !replacementSenderName ||
      typeof replacementSenderName !== "string" ||
      !replacementSenderName.trim()
    ) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message: "replacementSenderName no puede estar vacío.",
        },
        { status: 400 },
      );
    }

    if (
      !replacementReceiverName ||
      typeof replacementReceiverName !== "string" ||
      !replacementReceiverName.trim()
    ) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message: "replacementReceiverName no puede estar vacío.",
        },
        { status: 400 },
      );
    }

    // Validar UUIDs y campos opcionales
    if (operatorMemberId && !UUID_REGEX.test(operatorMemberId)) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message:
            "operatorMemberId debe ser un UUID válido si se proporciona.",
        },
        { status: 400 },
      );
    }
    if (supervisorMemberId && !UUID_REGEX.test(supervisorMemberId)) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message:
            "supervisorMemberId debe ser un UUID válido si se proporciona.",
        },
        { status: 400 },
      );
    }

    // Verificar que exista al menos un medio de autenticación de operador
    if (!ownerSession && !sessionToken && (!operatorMemberId || !operatorPin)) {
      return NextResponse.json(
        {
          ok: false,
          code: "AUTH_REQUIRED",
          message:
            "Se requiere token de sesión operativo o credenciales de operador (o sesión de dueño).",
        },
        { status: 401 },
      );
    }

    // 3. Invocación RPC v2 canónica
    const result = await executeV2Rpc<CorrectOperationResult>(
      "rpc_correct_operation",
      [
        businessId,
        workstationId,
        idempotencyKey.trim(),
        originalOperationId,
        reason.trim(),
        replacementAmountCents,
        replacementSourceResourceId,
        replacementDestinationResourceId,
        replacementSenderName.trim(),
        replacementReceiverName.trim(),
        sessionToken,
        operatorMemberId || null,
        operatorPin || null,
        replacementCustomerAccountRef || null,
        replacementBankFolio || null,
        replacementCommissionOverrideCents ?? null,
        supervisorPin || null,
        supervisorMemberId || null,
      ],
      { authenticatedUserId: ownerSession?.ownerUserId },
    );

    if (!result.ok) {
      const statusCode =
        result.code === "OPERATIONAL_SESSION_EXPIRED" ||
        result.code === "OPERATIONAL_SESSION_REVOKED" ||
        result.code === "INVALID_OPERATOR_PIN" ||
        result.code === "INVALID_OPERATOR_CREDENTIALS" ||
        result.code === "AUTH_REQUIRED"
          ? 401
          : result.code === "FORBIDDEN_BUSINESS_ACCESS" ||
              result.code === "SUPERVISOR_REQUIRED_FOR_CORRECTION" ||
              result.code === "INVALID_SUPERVISOR_PIN"
            ? 403
            : result.code === "ALREADY_CORRECTED" ||
                result.code === "ORIGINAL_NOT_COMPLETED" ||
                result.code === "IDEMPOTENCY_CONFLICT" ||
                result.code === "CONCURRENT_OPERATION_IN_PROGRESS" ||
                result.code === "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_RPC" ||
                result.code === "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD"
              ? 409
              : 400;

      return NextResponse.json(result, { status: statusCode });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Error interno procesando corrección de operación.";
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
