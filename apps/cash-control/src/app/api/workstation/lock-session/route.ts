import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
    try {
        const cookieStore = await cookies();
        cookieStore.delete("cash_control_operator");

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Error al bloquear sesión:", error);
        return NextResponse.json(
            { ok: false, error: "No se pudo cerrar la sesión local." },
            { status: 500 }
        );
    }
}
