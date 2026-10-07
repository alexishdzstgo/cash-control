import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> } // Soporte Next 15 Async Params
) {
    try {
        const { id: shiftId } = await params;
        const body = await request.json();

        // Evitar duplicados activos
        const { data: existing } = await supabaseServer
            .from("shift_participants")
            .select("id")
            .eq("shift_id", shiftId)
            .eq("user_id", body.userId)
            .eq("status", "active")
            .single();

        if (existing) {
            return NextResponse.json({ ok: false, error: "El usuario ya está activo en este turno." }, { status: 400 });
        }

        const payload = {
            shift_id: shiftId,
            user_id: body.userId,
            user_name: body.userName,
            system_role: body.systemRole || "employee",
            shift_role: body.shiftRole || "operator",
            status: "active",
            joined_at: body.joinedAt || new Date().toISOString()
        };

        const { data, error } = await supabaseServer
            .from("shift_participants")
            .insert(payload)
            .select()
            .single();

        if (error) throw new Error(error.message);

        return NextResponse.json({ ok: true, participant: data });
    } catch (error) {
        console.error("Error al unir participante:", error);
        return NextResponse.json(
            { ok: false, error: error instanceof Error ? error.message : "Error desconocido" },
            { status: 500 }
        );
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: shiftId } = await params;
        const body = await request.json();

        const { data, error } = await supabaseServer
            .from("shift_participants")
            .update({
                status: body.status || "left",
                left_at: body.leftAt || new Date().toISOString()
            })
            .eq("shift_id", shiftId)
            .eq("user_id", body.userId)
            .eq("status", "active") // Solo afectar participantes activos
            .select()
            .single();

        if (error) throw new Error(error.message);

        return NextResponse.json({ ok: true, participant: data });
    } catch (error) {
        console.error("Error al remover participante:", error);
        return NextResponse.json(
            { ok: false, error: error instanceof Error ? error.message : "Error desconocido" },
            { status: 500 }
        );
    }
}
