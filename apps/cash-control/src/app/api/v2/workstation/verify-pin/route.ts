import { NextResponse } from "next/server";
import { getAuthenticatedOwner } from "@/lib/api-v2/server/auth";
import { getV2LocalPool } from "@/lib/api-v2/server/db";
import type { V2ApiResponse, VerifyMemberPinResult } from "@/lib/api-v2/types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
): Promise<NextResponse<V2ApiResponse<VerifyMemberPinResult>>> {
  try {
    const ownerSession = await getAuthenticatedOwner(request);
    if (!ownerSession) {
      return NextResponse.json(
        {
          ok: false,
          code: "UNAUTHORIZED",
          message:
            "No autenticado. Se requiere una sesión válida del dueño en el servidor.",
        },
        { status: 401 },
      );
    }

    const body = (await request.json()) as {
      memberId?: unknown;
      pin?: unknown;
    };

    const { memberId, pin } = body;

    if (typeof memberId !== "string" || !UUID_REGEX.test(memberId)) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message: "memberId debe ser un UUID válido.",
        },
        { status: 400 },
      );
    }

    if (typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message: "El PIN debe tener exactamente 4 dígitos numéricos.",
        },
        { status: 400 },
      );
    }

    const pool = getV2LocalPool();

    // Invocar función de PostgreSQL fn_verify_member_pin en cash_control_test
    const pinRes = await pool.query(
      "SELECT public.fn_verify_member_pin($1, $2, $3) AS valid;",
      [ownerSession.businessId, memberId, pin],
    );

    const isValid = pinRes.rows[0]?.valid === true;

    if (!isValid) {
      return NextResponse.json(
        {
          ok: true as const,
          data: {
            valid: false,
            memberId,
          },
        },
        { status: 200 },
      );
    }

    // Obtener detalles del miembro autenticado
    const memberRes = await pool.query(
      "SELECT id, full_name, role FROM public.business_members WHERE id = $1 AND business_id = $2 AND status = 'active';",
      [memberId, ownerSession.businessId],
    );

    const memberRow = memberRes.rows[0];

    return NextResponse.json(
      {
        ok: true as const,
        data: {
          valid: true,
          memberId,
          fullName: memberRow?.full_name,
          role: memberRow?.role,
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Error al verificar PIN.";
    return NextResponse.json(
      {
        ok: false,
        code: "INTERNAL_SERVER_ERROR",
        message,
      },
      { status: 500 },
    );
  }
}
