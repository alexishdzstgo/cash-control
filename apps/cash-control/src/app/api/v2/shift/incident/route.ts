import { NextResponse } from "next/server";
import { getAuthenticatedOwner } from "@/lib/api-v2/server/auth";
import { executeV2Rpc } from "@/lib/api-v2/server/db";
import type {
  IncidenceResolutionType,
  ResolveIncidenceParams,
  ResolveIncidenceResult,
  V2ApiResponse,
} from "@/lib/api-v2/types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_RESOLUTION_TYPES: ReadonlySet<IncidenceResolutionType> = new Set([
  "reintegration_partial",
  "reintegration_final",
  "explained_by_operation",
  "confirmed_loss",
  "confirmed_surplus",
]);

export async function POST(
  request: Request,
): Promise<NextResponse<V2ApiResponse<ResolveIncidenceResult>>> {
  try {
    // 1. Verificación opcional de sesión de dueño autenticado (para auth.uid())
    const ownerSession = await getAuthenticatedOwner(request);

    const body = (await request.json()) as Partial<ResolveIncidenceParams>;

    const {
      businessId,
      workstationId,
      idempotencyKey,
      incidenceId,
      eventType,
      amountResolvedCents,
      sessionToken: bodyToken,
      operatorMemberId,
      operatorPin,
      linkedOperationId,
      linkedAdminMovementId,
      notes,
      supervisorPin,
      supervisorMemberId,
    } = body;

    // Token operativo de terminal: priorizar cabecera x-terminal-session
    const headerToken = request.headers.get("x-terminal-session");
    const sessionToken = headerToken || bodyToken || null;

    // 2. Validaciones generales de entrada
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

    if (!incidenceId || !UUID_REGEX.test(incidenceId)) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message: "incidenceId debe ser un UUID válido.",
        },
        { status: 400 },
      );
    }

    if (!eventType || !VALID_RESOLUTION_TYPES.has(eventType)) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message: `Tipo de resolución inválido: '${eventType}'. Tipos válidos: ${Array.from(VALID_RESOLUTION_TYPES).join(", ")}.`,
        },
        { status: 400 },
      );
    }

    if (
      typeof amountResolvedCents !== "number" ||
      !Number.isInteger(amountResolvedCents) ||
      amountResolvedCents <= 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message:
            "amountResolvedCents debe ser un entero positivo mayor a cero.",
        },
        { status: 400 },
      );
    }

    if (
      linkedOperationId !== undefined &&
      linkedOperationId !== null &&
      !UUID_REGEX.test(linkedOperationId)
    ) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message:
            "linkedOperationId debe ser un UUID válido si se proporciona.",
        },
        { status: 400 },
      );
    }

    if (
      linkedAdminMovementId !== undefined &&
      linkedAdminMovementId !== null &&
      !UUID_REGEX.test(linkedAdminMovementId)
    ) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message:
            "linkedAdminMovementId debe ser un UUID válido si se proporciona.",
        },
        { status: 400 },
      );
    }

    // Autenticación de operador / terminal
    const hasSessionToken = Boolean(sessionToken?.trim());
    const hasOperatorCredentials = Boolean(
      operatorMemberId &&
        UUID_REGEX.test(operatorMemberId) &&
        operatorPin &&
        /^\d{4}$/.test(operatorPin),
    );

    if (!hasSessionToken && !hasOperatorCredentials) {
      return NextResponse.json(
        {
          ok: false,
          code: "AUTH_REQUIRED",
          message:
            "Se requiere token de sesión operativo o credenciales de operador (memberId + PIN).",
        },
        { status: 401 },
      );
    }

    // 3. Invocar rpc_resolve_incidence
    const result = await executeV2Rpc<ResolveIncidenceResult>(
      "rpc_resolve_incidence",
      [
        businessId,
        workstationId,
        idempotencyKey.trim(),
        incidenceId,
        eventType,
        amountResolvedCents,
        sessionToken,
        operatorMemberId || null,
        operatorPin || null,
        linkedOperationId || null,
        linkedAdminMovementId || null,
        notes || null,
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
              result.code === "OWNER_EXCLUSIVE"
            ? 403
            : result.code === "INCIDENCE_ALREADY_RESOLVED" ||
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
        : "Error interno procesando resolución de incidencia.";
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
