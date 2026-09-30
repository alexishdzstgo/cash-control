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
                { ok: true, session: null },
                { status: 200 }
            );
        }

        const { data: operatorData, error: operatorError } = await supabaseServer.rpc(
            "admin_resolve_operator_session",
            { p_token_hash: hashToken(operatorToken) }
        );

        if (operatorError || !operatorData || operatorData.length === 0) {
            return NextResponse.json(
                { ok: true, session: null },
                { status: 200 }
            );
        }

        const operator = operatorData[0];
        const memberId = operator.member_id;

        // Fetch user details
        const { data: memberData, error: memberError } = await supabaseServer
            .from("business_members")
            .select(`
        id,
        role,
        profiles ( display_name, first_name, last_name )
      `)
            .eq("id", memberId)
            .single();

        if (memberError || !memberData) {
            return NextResponse.json(
                { ok: true, session: null },
                { status: 200 }
            );
        }

        const profile = Array.isArray(memberData.profiles)
            ? memberData.profiles[0]
            : memberData.profiles;

        const displayName = profile?.display_name ||
            `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() ||
            "Operador";

        return NextResponse.json({
            ok: true,
            session: {
                userId: memberData.id,
                userName: displayName,
                systemRole: memberData.role,
                hasActiveParticipation: false // this is handled by the UI merging with realParticipants
            }
        });

    } catch (error) {
        console.error("Error fetching operator session:", error);
        return NextResponse.json(
            { ok: false, error: "Error fetching session." },
            { status: 500 }
        );
    }
}
