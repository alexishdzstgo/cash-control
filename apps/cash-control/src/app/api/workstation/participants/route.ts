import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

const BUSINESS_ID = "24f9fbd1-3234-4b4c-aca3-ad121cdb08ba";

export async function GET() {
  try {
    const { data, error } = await supabaseServer.rpc(
      "get_workstation_active_participants",
      {
        p_business_id: BUSINESS_ID,
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