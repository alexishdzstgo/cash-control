import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      memberId?: unknown;
      pin?: unknown;
    };

    if (
      typeof body.memberId !== "string" ||
      !body.memberId.trim() ||
      typeof body.pin !== "string" ||
      !/^\d{4}$/.test(body.pin)
    ) {
      return NextResponse.json(
        { ok: false, error: "Datos de PIN inválidos." },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseServer.rpc(
      "admin_verify_member_pin",
      {
        p_member_id: body.memberId,
        p_pin: body.pin,
      },
    );

    if (error) {
      console.error("Error verificando PIN:", error);

      return NextResponse.json(
        { ok: false, error: "No se pudo verificar el PIN." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      valid: data === true,
    });
  } catch (error) {
    console.error("Error procesando verificación de PIN:", error);

    return NextResponse.json(
      { ok: false, error: "Solicitud inválida." },
      { status: 400 },
    );
  }
}