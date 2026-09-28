import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";
import { hashToken } from "@/lib/security/tokens";

const OPERATOR_COOKIE = "cash_control_operator";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const operatorToken = cookieStore.get(OPERATOR_COOKIE)?.value;

    if (!operatorToken) {
      return NextResponse.json(
        { ok: false, error: "No existe una sesión de operador activa." },
        { status: 401 },
      );
    }

    const { data, error } = await supabaseServer.rpc(
      "admin_leave_shift",
      {
        p_operator_token_hash: hashToken(operatorToken),
      },
    );

    if (error) {
      console.error("Error finalizando participación:", error);

      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: error.code === "42501" ? 403 : 400 },
      );
    }

    const participation = data?.[0];

    if (!participation) {
      return NextResponse.json(
        {
          ok: false,
          error: "No se pudo obtener la participación finalizada.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      participation: {
        shiftId: participation.shift_id,
        memberId: participation.member_id,
        role: participation.role,
        status: participation.status,
        joinedAt: participation.joined_at,
        leftAt: participation.left_at,
      },
    });
  } catch (error) {
    console.error("Error procesando finalización:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "No se pudo finalizar la participación.",
      },
      { status: 500 },
    );
  }
}