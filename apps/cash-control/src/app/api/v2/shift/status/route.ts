import { NextResponse } from "next/server";
import { getV2LocalPool } from "@/lib/api-v2/server/db";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");
    const workstationId = searchParams.get("workstationId");
    const sessionToken = request.headers.get("x-terminal-session");

    if (
      !businessId ||
      !UUID_REGEX.test(businessId) ||
      !workstationId ||
      !UUID_REGEX.test(workstationId)
    ) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message: "businessId y workstationId deben ser UUIDs válidos.",
        },
        { status: 400 },
      );
    }

    const pool = getV2LocalPool();

    // 1. Obtener turno abierto en la estación
    const shiftQuery = `
      SELECT id, folio, status, opened_at, opened_by_member_id
      FROM public.shifts
      WHERE business_id = $1 AND workstation_id = $2 AND status = 'open'
      LIMIT 1;
    `;
    const shiftRes = await pool.query(shiftQuery, [businessId, workstationId]);
    const activeShift = shiftRes.rows[0] || null;

    let participants: Array<{
      id: string;
      memberId: string;
      fullName: string;
      roleInShift: string;
      joinedAt: string;
    }> = [];

    if (activeShift) {
      const partQuery = `
        SELECT sp.id, sp.member_id as "memberId", bm.full_name as "fullName",
               sp.role_in_shift as "roleInShift", sp.joined_at as "joinedAt"
        FROM public.shift_participants sp
        JOIN public.business_members bm ON bm.id = sp.member_id
        WHERE sp.shift_id = $1 AND sp.status = 'active'
        ORDER BY sp.joined_at ASC;
      `;
      const partRes = await pool.query(partQuery, [activeShift.id]);
      participants = partRes.rows;
    }

    // 2. Si se envió token de terminal, validar validez
    let sessionValid = false;
    let operatorMemberId: string | null = null;

    if (sessionToken && activeShift) {
      const sessionQuery = `
        SELECT id, operator_member_id
        FROM public.terminal_operator_sessions
        WHERE workstation_id = $1
          AND session_token_hash = encode(sha256($2::bytea), 'hex')
          AND shift_id = $3
          AND revoked_at IS NULL
          AND expires_at > clock_timestamp();
      `;
      const sessionRes = await pool.query(sessionQuery, [
        workstationId,
        sessionToken,
        activeShift.id,
      ]);
      if (sessionRes.rows.length > 0) {
        sessionValid = true;
        operatorMemberId = sessionRes.rows[0].operator_member_id;
      }
    }

    return NextResponse.json({
      ok: true,
      data: {
        hasOpenShift: !!activeShift,
        shift: activeShift,
        participants,
        sessionValid,
        operatorMemberId,
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Error al consultar estado de turno.";
    return NextResponse.json(
      { ok: false, code: "INTERNAL_SERVER_ERROR", message },
      { status: 500 },
    );
  }
}
