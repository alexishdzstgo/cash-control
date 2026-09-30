
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { hashToken } from "@/lib/security/tokens";
import { supabaseServer } from "@/lib/supabase/server";

const OPERATOR_COOKIE = "cash_control_operator";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      newResponsibleMemberId?: unknown;
      receiverPin?: unknown;
    } | null;

    const memberId = body?.newResponsibleMemberId;
    const receiverPin = body?.receiverPin;

    if (
      typeof memberId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(memberId)
    ) {
      return NextResponse.json(
        { ok: false, error: "Selecciona un participante válido." },
        { status: 400 },
      );
    }

    if (
      typeof receiverPin !== "string" ||
      !/^\d{4}$/.test(receiverPin)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "El PIN debe tener exactamente 4 dígitos.",
        },
        { status: 400 },
      );
    }

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
      "admin_transfer_shift_responsibility_with_pin",
      {
        p_operator_token_hash: hashToken(operatorToken),
        p_new_responsible_member_id: memberId,
        p_receiver_pin: receiverPin,
      },
    );

    if (error) {
      console.error("Error transfiriendo responsabilidad:", error);

      return NextResponse.json(
        {
          ok: false,
          error:
            error.code === "42501"
              ? "No tienes permiso para transferir la responsabilidad."
              : "No se pudo realizar la transferencia.",
        },
        { status: error.code === "42501" ? 403 : 400 },
      );
    }

    const result = Array.isArray(data) ? data[0] : data;

    if (!result) {
      return NextResponse.json(
        {
          ok: false,
          error: "No se recibió confirmación de Supabase.",
        },
        { status: 500 },
      );
    }

    if (
      result.pin_verified === false ||
      result.success === false ||
      result.transferred === false
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            result.pin_verified === false
              ? "El PIN del nuevo responsable es incorrecto."
              : "No se pudo realizar la transferencia.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      transfer: result,
    });
  } catch (error) {
    console.error("Error procesando transferencia:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Ocurrió un error al transferir la responsabilidad.",
      },
      { status: 500 },
    );
  }
}