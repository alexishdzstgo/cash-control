import { NextResponse } from "next/server";
import { getAuthenticatedOwner } from "@/lib/api-v2/server/auth";
import { executeV2Rpc } from "@/lib/api-v2/server/db";
import type {
  AdministrativeMovementCategory,
  AdministrativeMovementResult,
  RegisterAdministrativeMovementParams,
  V2ApiResponse,
} from "@/lib/api-v2/types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_CATEGORIES: ReadonlySet<AdministrativeMovementCategory> = new Set([
  "transfer_internal",
  "expense_out",
  "funding_in",
  "owner_capital_injection",
  "owner_drawing_withdrawal",
  "reconciliation_adjustment",
]);

export async function POST(
  request: Request,
): Promise<NextResponse<V2ApiResponse<AdministrativeMovementResult>>> {
  try {
    // 1. Verificación opcional/previa de sesión de dueño autenticado
    const ownerSession = await getAuthenticatedOwner(request);

    const body =
      (await request.json()) as Partial<RegisterAdministrativeMovementParams>;

    const {
      businessId,
      workstationId,
      idempotencyKey,
      category,
      amountCents,
      originResourceId,
      destinationResourceId,
      accountId,
      sessionToken: bodyToken,
      operatorMemberId,
      operatorPin,
      voucherUrl,
      notes,
      authorizedByMemberId,
      supervisorPin,
    } = body;

    // Token operativo de terminal: priorizar cabecera x-terminal-session
    const headerToken = request.headers.get("x-terminal-session");
    const sessionToken = headerToken || bodyToken || null;

    // 2. Validaciones generales de entrada en servidor
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

    // Control multi-inquilino si el dueño se autenticó
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

    if (!category || !VALID_CATEGORIES.has(category)) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message: `Categoría inválida: '${category}'. Categorías válidas: ${Array.from(VALID_CATEGORIES).join(", ")}.`,
        },
        { status: 400 },
      );
    }

    if (
      typeof amountCents !== "number" ||
      !Number.isInteger(amountCents) ||
      amountCents <= 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_AMOUNT",
          message: "amountCents debe ser un entero positivo mayor a cero.",
        },
        { status: 400 },
      );
    }

    // Validaciones específicas por categoría
    if (category === "transfer_internal") {
      if (!originResourceId || !UUID_REGEX.test(originResourceId)) {
        return NextResponse.json(
          {
            ok: false,
            code: "VALIDATION_ERROR",
            message:
              "transfer_internal requiere originResourceId como UUID válido.",
          },
          { status: 400 },
        );
      }
      if (!destinationResourceId || !UUID_REGEX.test(destinationResourceId)) {
        return NextResponse.json(
          {
            ok: false,
            code: "VALIDATION_ERROR",
            message:
              "transfer_internal requiere destinationResourceId como UUID válido.",
          },
          { status: 400 },
        );
      }
      if (originResourceId === destinationResourceId) {
        return NextResponse.json(
          {
            ok: false,
            code: "INVALID_TRANSFER_RESOURCES",
            message: "Traslado requiere origen y destino distintos.",
          },
          { status: 400 },
        );
      }
    } else if (
      category === "funding_in" ||
      category === "owner_capital_injection"
    ) {
      if (!destinationResourceId || !UUID_REGEX.test(destinationResourceId)) {
        return NextResponse.json(
          {
            ok: false,
            code: "DESTINATION_REQUIRED",
            message: `${category} requiere destinationResourceId como UUID válido.`,
          },
          { status: 400 },
        );
      }
    } else if (
      category === "expense_out" ||
      category === "owner_drawing_withdrawal"
    ) {
      if (!originResourceId || !UUID_REGEX.test(originResourceId)) {
        return NextResponse.json(
          {
            ok: false,
            code: "ORIGIN_REQUIRED",
            message: `${category} requiere originResourceId como UUID válido.`,
          },
          { status: 400 },
        );
      }
    } else if (category === "reconciliation_adjustment") {
      if (
        (!originResourceId || !UUID_REGEX.test(originResourceId)) &&
        (!destinationResourceId || !UUID_REGEX.test(destinationResourceId))
      ) {
        return NextResponse.json(
          {
            ok: false,
            code: "VALIDATION_ERROR",
            message:
              "reconciliation_adjustment requiere al menos originResourceId o destinationResourceId.",
          },
          { status: 400 },
        );
      }
    }

    // Validar UUIDs opcionales
    if (accountId && !UUID_REGEX.test(accountId)) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message: "accountId debe ser un UUID válido si se proporciona.",
        },
        { status: 400 },
      );
    }
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
    if (authorizedByMemberId && !UUID_REGEX.test(authorizedByMemberId)) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message:
            "authorizedByMemberId debe ser un UUID válido si se proporciona.",
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

    // 3. Invocación RPC v2 a PostgreSQL local
    const result = await executeV2Rpc<AdministrativeMovementResult>(
      "rpc_register_administrative_movement",
      [
        businessId,
        workstationId,
        idempotencyKey.trim(),
        category,
        amountCents,
        originResourceId || null,
        destinationResourceId || null,
        accountId || null,
        sessionToken,
        operatorMemberId || null,
        operatorPin || null,
        voucherUrl || null,
        notes || null,
        authorizedByMemberId || null,
        supervisorPin || null,
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
              result.code === "OWNER_EXCLUSIVE" ||
              result.code === "SUPERVISOR_APPROVAL_REQUIRED"
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
        : "Error interno procesando movimiento administrativo.";
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
