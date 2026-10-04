import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";
import { generateToken, hashToken } from "@/lib/security/tokens";

const BUSINESS_ID = "24f9fbd1-3234-4b4c-aca3-ad121cdb08ba";

const WORKSTATION_COOKIE = "cash_control_workstation";
const OPERATOR_COOKIE = "cash_control_operator";

const WORKSTATION_HOURS = 23;
const OPERATOR_HOURS = 12;

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
        {
          ok: false,
          error: "Datos de PIN inválidos.",
        },
        { status: 400 },
      );
    }

    const memberId = body.memberId.trim();

    // 1. Verificar PIN real contra Supabase.
    const { data: pinValid, error: pinError } =
      await supabaseServer.rpc("admin_verify_member_pin", {
        p_member_id: memberId,
        p_pin: body.pin,
      });

    if (pinError) {
      console.error("Error verificando PIN:", pinError);

      return NextResponse.json(
        {
          ok: false,
          error: "No se pudo verificar el PIN.",
        },
        { status: 500 },
      );
    }

    if (pinValid !== true) {
      return NextResponse.json({
        ok: true,
        valid: false,
      });
    }

    // Registrar acceso únicamente después de validar el PIN.
    const { error: lastLoginError } = await supabaseServer
      .from("business_members")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", memberId)
      .eq("business_id", BUSINESS_ID)
      .eq("status", "active");

    if (lastLoginError) {
      console.error("Error registrando último acceso:", lastLoginError);
      return NextResponse.json(
        { ok: false, error: "No se pudo registrar el acceso." },
        { status: 500 },
      );
    }

    const cookieStore = await cookies();

    /*
     * 2. Recuperar workstation existente o crear una nueva.
     */
    let workstationToken = cookieStore.get(WORKSTATION_COOKIE)?.value;
    let workstationTokenHash: string;
    let workstationCreated = false;
    let workstationExpiresAt: string | null = null;

    if (workstationToken) {
      workstationTokenHash = hashToken(workstationToken);

      const { data: workstationData, error: workstationError } =
        await supabaseServer.rpc("admin_resolve_workstation_session", {
          p_token_hash: workstationTokenHash,
        });

      const workstation = workstationData?.[0];

      if (
        workstationError ||
        !workstation ||
        workstation.business_id !== BUSINESS_ID
      ) {
        workstationToken = undefined;
      } else {
        workstationExpiresAt = workstation.workstation_expires_at;
      }
    }

    if (!workstationToken) {
      workstationToken = generateToken();
      workstationTokenHash = hashToken(workstationToken);
      workstationCreated = true;

      workstationExpiresAt = new Date(
        Date.now() + WORKSTATION_HOURS * 60 * 60 * 1000,
      ).toISOString();

      const { data: workstationId, error: workstationError } =
        await supabaseServer.rpc("admin_create_workstation_session", {
          p_business_id: BUSINESS_ID,
          p_created_by_member_id: memberId,
          p_token_hash: workstationTokenHash,
          p_expires_at: workstationExpiresAt,
        });

      if (workstationError || !workstationId) {
        console.error(
          "Error creando sesión de workstation:",
          workstationError,
        );

        return NextResponse.json(
          {
            ok: false,
            error: "No se pudo crear la sesión de workstation.",
          },
          { status: 500 },
        );
      }
    } else {
      workstationTokenHash = hashToken(workstationToken);

      /*
       * 3. Si la workstation ya existía, activar al miembro
       *    dentro de esta workstation. (Requisito técnico para operatorToken)
       */
      const { error: activationError } =
        await supabaseServer.rpc("admin_activate_workstation_member", {
          p_workstation_token_hash: workstationTokenHash,
          p_member_id: memberId,
        });

      if (activationError) {
        console.error(
          "Error activando miembro en workstation:",
          activationError,
        );

        return NextResponse.json(
          {
            ok: false,
            error: "No se pudo activar el usuario en esta workstation.",
          },
          { status: 400 },
        );
      }
    }

    /*
     * 4. Crear una sesión de operador nueva para este usuario.
     */
    const operatorToken = generateToken();
    const operatorTokenHash = hashToken(operatorToken);

    const operatorLimit = new Date(
      Date.now() + OPERATOR_HOURS * 60 * 60 * 1000 - 5 * 60 * 1000,
    );

    const operatorExpiresAt = new Date(
      Math.min(
        operatorLimit.getTime(),
        workstationExpiresAt
          ? new Date(workstationExpiresAt).getTime()
          : operatorLimit.getTime(),
      ),
    ).toISOString();


    const { data: operatorSessionId, error: operatorError } =
      await supabaseServer.rpc("admin_issue_operator_session", {
        p_workstation_token_hash: workstationTokenHash,
        p_member_id: memberId,
        p_token_hash: operatorTokenHash,
        p_expires_at: operatorExpiresAt,
      });

    if (operatorError || !operatorSessionId) {
      console.error(
        "Error creando sesión de operador:",
        operatorError,
      );

      return NextResponse.json(
        {
          ok: false,
          error: "No se pudo crear la sesión de operador.",
        },
        { status: 500 },
      );
    }

    /*
     * 5. Crear respuesta y guardar tokens únicamente
     *    en cookies HttpOnly.
     */
    const response = NextResponse.json({
      ok: true,
      valid: true,
      session: {
        workstationCreated,
        operatorSessionId,
      },
    });

    response.cookies.set({
      name: WORKSTATION_COOKIE,
      value: workstationToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: WORKSTATION_HOURS * 60 * 60,
    });

    response.cookies.set({
      name: OPERATOR_COOKIE,
      value: operatorToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: OPERATOR_HOURS * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error(
      "Error procesando autenticación de workstation:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error: "No se pudo completar la autenticación.",
      },
      { status: 500 },
    );
  }
}