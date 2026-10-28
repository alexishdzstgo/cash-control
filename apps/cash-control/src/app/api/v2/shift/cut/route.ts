import { NextResponse } from "next/server";
import { getAuthenticatedOwner } from "@/lib/api-v2/server/auth";
import { executeV2Rpc } from "@/lib/api-v2/server/db";
import type {
  PerformCutParams,
  PerformCutResult,
  V2ApiResponse,
} from "@/lib/api-v2/types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
): Promise<NextResponse<V2ApiResponse<PerformCutResult>>> {
  try {
    // 1. Verificación opcional de sesión de dueño autenticado (para auth.uid())
    const ownerSession = await getAuthenticatedOwner(request);

    const body = (await request.json()) as Partial<PerformCutParams>;

    const {
      businessId,
      workstationId,
      idempotencyKey,
      auditedShiftIds,
      cashCounts,
      bankAudits,
      sessionToken: bodyToken,
      operatorMemberId,
      operatorPin,
      notes,
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

    // Validar auditedShiftIds si se proporcionó
    if (auditedShiftIds !== undefined && auditedShiftIds !== null) {
      if (!Array.isArray(auditedShiftIds)) {
        return NextResponse.json(
          {
            ok: false,
            code: "VALIDATION_ERROR",
            message: "auditedShiftIds debe ser un arreglo de UUIDs.",
          },
          { status: 400 },
        );
      }
      for (const shiftId of auditedShiftIds) {
        if (!shiftId || !UUID_REGEX.test(shiftId)) {
          return NextResponse.json(
            {
              ok: false,
              code: "VALIDATION_ERROR",
              message: `ID de turno auditado inválido: '${shiftId}'. Debe ser un UUID.`,
            },
            { status: 400 },
          );
        }
      }
    }

    // Validar conteos de caja física (cashCounts)
    if (cashCounts !== undefined && cashCounts !== null) {
      if (!Array.isArray(cashCounts)) {
        return NextResponse.json(
          {
            ok: false,
            code: "VALIDATION_ERROR",
            message: "cashCounts debe ser un arreglo.",
          },
          { status: 400 },
        );
      }
      for (const item of cashCounts) {
        if (!item.resource_id || !UUID_REGEX.test(item.resource_id)) {
          return NextResponse.json(
            {
              ok: false,
              code: "VALIDATION_ERROR",
              message: `resource_id inválido en conteo de caja: '${item.resource_id}'. Debe ser un UUID.`,
            },
            { status: 400 },
          );
        }
        if (
          typeof item.counted_amount_cents !== "number" ||
          !Number.isInteger(item.counted_amount_cents) ||
          item.counted_amount_cents < 0
        ) {
          return NextResponse.json(
            {
              ok: false,
              code: "VALIDATION_ERROR",
              message:
                "counted_amount_cents debe ser un entero mayor o igual a cero.",
            },
            { status: 400 },
          );
        }
      }
    }

    // Validar auditorías bancarias (bankAudits)
    if (bankAudits !== undefined && bankAudits !== null) {
      if (!Array.isArray(bankAudits)) {
        return NextResponse.json(
          {
            ok: false,
            code: "VALIDATION_ERROR",
            message: "bankAudits debe ser un arreglo.",
          },
          { status: 400 },
        );
      }
      for (const item of bankAudits) {
        if (!item.resource_id || !UUID_REGEX.test(item.resource_id)) {
          return NextResponse.json(
            {
              ok: false,
              code: "VALIDATION_ERROR",
              message: `resource_id inválido en auditoría bancaria: '${item.resource_id}'. Debe ser un UUID.`,
            },
            { status: 400 },
          );
        }
        if (
          typeof item.observed_balance_cents !== "number" ||
          !Number.isInteger(item.observed_balance_cents) ||
          item.observed_balance_cents < 0
        ) {
          return NextResponse.json(
            {
              ok: false,
              code: "VALIDATION_ERROR",
              message:
                "observed_balance_cents debe ser un entero mayor o igual a cero.",
            },
            { status: 400 },
          );
        }
      }
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

    // 3. Invocar rpc_perform_cut_reconciliation
    const result = await executeV2Rpc<PerformCutResult>(
      "rpc_perform_cut_reconciliation",
      [
        businessId,
        workstationId,
        idempotencyKey.trim(),
        auditedShiftIds && auditedShiftIds.length > 0 ? auditedShiftIds : null,
        cashCounts ? JSON.stringify(cashCounts) : JSON.stringify([]),
        bankAudits ? JSON.stringify(bankAudits) : JSON.stringify([]),
        sessionToken,
        operatorMemberId || null,
        operatorPin || null,
        notes || null,
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
            : result.code === "IDEMPOTENCY_CONFLICT" ||
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
        : "Error interno procesando corte y conciliación.";
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
