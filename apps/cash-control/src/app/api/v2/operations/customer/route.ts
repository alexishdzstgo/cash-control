import { NextResponse } from "next/server";
import { executeV2Rpc } from "@/lib/api-v2/server/db";
import type {
  CustomerOperationResult,
  RegisterCustomerOperationParams,
  V2ApiResponse,
} from "@/lib/api-v2/types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
): Promise<NextResponse<V2ApiResponse<CustomerOperationResult>>> {
  try {
    const body =
      (await request.json()) as Partial<RegisterCustomerOperationParams>;

    const {
      businessId,
      workstationId,
      idempotencyKey,
      type,
      amountCents,
      sourceResourceId,
      destinationResourceId,
      senderName,
      receiverName,
      sessionToken: bodyToken,
      operatorMemberId,
      operatorPin,
      customerAccountRef,
      bankFolio,
      notes,
      commissionOverrideCents,
      supervisorPin,
      supervisorMemberId,
    } = body;

    // Token operativo de terminal: priorizar cabecera x-terminal-session
    const headerToken = request.headers.get("x-terminal-session");
    const sessionToken = headerToken || bodyToken || null;

    // 1. Validaciones de entrada
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

    if (type !== "deposit" && type !== "withdrawal") {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message: "type debe ser 'deposit' o 'withdrawal'.",
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
          code: "VALIDATION_ERROR",
          message: "amountCents debe ser un entero positivo mayor a cero.",
        },
        { status: 400 },
      );
    }

    if (!sourceResourceId || !UUID_REGEX.test(sourceResourceId)) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message: "sourceResourceId debe ser un UUID válido.",
        },
        { status: 400 },
      );
    }

    if (!destinationResourceId || !UUID_REGEX.test(destinationResourceId)) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message: "destinationResourceId debe ser un UUID válido.",
        },
        { status: 400 },
      );
    }

    if (sourceResourceId === destinationResourceId) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message:
            "sourceResourceId y destinationResourceId deben ser distintos.",
        },
        { status: 400 },
      );
    }

    if (!senderName || typeof senderName !== "string" || !senderName.trim()) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message: "senderName no puede estar vacío.",
        },
        { status: 400 },
      );
    }

    if (
      !receiverName ||
      typeof receiverName !== "string" ||
      !receiverName.trim()
    ) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message: "receiverName no puede estar vacío.",
        },
        { status: 400 },
      );
    }

    // 2. Invocar RPC canónica de operación financiera
    const result = await executeV2Rpc<CustomerOperationResult>(
      "rpc_register_customer_operation",
      [
        businessId,
        workstationId,
        idempotencyKey.trim(),
        type,
        amountCents,
        sourceResourceId,
        destinationResourceId,
        senderName.trim(),
        receiverName.trim(),
        sessionToken,
        operatorMemberId || null,
        operatorPin || null,
        customerAccountRef || null,
        bankFolio || null,
        notes || null,
        commissionOverrideCents || null,
        supervisorPin || null,
        supervisorMemberId || null,
      ],
    );

    if (!result.ok) {
      const statusCode =
        result.code === "OPERATIONAL_SESSION_EXPIRED" ||
        result.code === "OPERATIONAL_SESSION_REVOKED" ||
        result.code === "INVALID_OPERATOR_PIN"
          ? 401
          : result.code === "FORBIDDEN_BUSINESS_ACCESS" ||
              result.code === "SUPERVISOR_APPROVAL_REQUIRED"
            ? 403
            : result.code === "IDEMPOTENCY_CONFLICT" ||
                result.code === "CONCURRENT_OPERATION_IN_PROGRESS"
              ? 409
              : 400;

      return NextResponse.json(result, { status: statusCode });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Error interno procesando operación de cliente.";
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
