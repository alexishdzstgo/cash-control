import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";
import { hashToken } from "@/lib/security/tokens";

const OPERATOR_COOKIE = "cash_control_operator";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const operatorToken = cookieStore.get(OPERATOR_COOKIE)?.value;

    if (!operatorToken) {
      return NextResponse.json(
        {
          ok: false,
          error: "No existe una sesión de operador activa.",
        },
        { status: 401 },
      );
    }

    const { data, error } = await supabaseServer.rpc(
      "admin_list_shift_participants",
      {
        p_operator_token_hash: hashToken(operatorToken),
      },
    );

    if (error) {
      console.error("Error obteniendo participantes:", error);

      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: error.code === "42501" ? 403 : 400 },
      );
    }

type SupabaseParticipant = {
  member_id: string;
  username: string;
  display_name: string;
  role: string;
  status: string;
  joined_at: string;
  left_at: string | null;
};

const participants = (data as SupabaseParticipant[] | null ?? []).map(
  (participant) => ({
    memberId: participant.member_id,
    username: participant.username,
    displayName: participant.display_name,
    role: participant.role,
    status: participant.status,
    joinedAt: participant.joined_at,
    leftAt: participant.left_at,
  }),
);

    return NextResponse.json({
      ok: true,
      participants,
    });
  } catch (error) {
    console.error("Error procesando participantes:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "No se pudieron obtener los participantes.",
      },
      { status: 500 },
    );
  }
}