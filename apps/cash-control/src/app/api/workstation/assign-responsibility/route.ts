import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";
import { hashToken } from "@/lib/security/tokens";

const OPERATOR_COOKIE = "cash_control_operator";

export async function POST(request: Request) {
    try {
        const { pin, userId } = await request.json();

        if (!pin || !userId) {
            return NextResponse.json(
                { ok: false, error: "El PIN y el ID de usuario son requeridos." },
                { status: 400 },
            );
        }

        const cookieStore = await cookies();
        const operatorToken = cookieStore.get(OPERATOR_COOKIE)?.value;

        if (!operatorToken) {
            return NextResponse.json(
                { ok: false, error: "No existe una sesión de operador activa." },
                { status: 401 },
            );
        }

        const { data: participation, error } = await supabaseServer.rpc(
            "admin_assign_participation_responsibility_with_pin",
            {
                p_operator_token_hash: hashToken(operatorToken),
                p_new_responsible_member_id: userId,
                p_receiver_pin: pin,
            },
        );

        if (error) {
            console.error("Error asumiendo responsabilidad:", error);

            return NextResponse.json(
                {
                    ok: false,
                    error: error.message,
                },
                { status: error.code === "42501" ? 403 : 400 },
            );
        }

        return NextResponse.json({
            ok: true,
            participation,
        });
    } catch (error) {
        console.error("Error procesando solicitud de responsabilidad:", error);

        return NextResponse.json(
            {
                ok: false,
                error: "No se pudo asumir la responsabilidad del turno.",
            },
            { status: 500 },
        );
    }
}
