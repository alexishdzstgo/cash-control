import { NextResponse } from "next/server";
import {
  createOwnerSessionToken,
  OWNER_SESSION_COOKIE,
} from "@/lib/api-v2/server/auth";
import { getV2LocalPool } from "@/lib/api-v2/server/db";
import type {
  OwnerLoginParams,
  OwnerLoginResult,
  V2ApiResponse,
} from "@/lib/api-v2/types";

export async function POST(
  request: Request,
): Promise<NextResponse<V2ApiResponse<OwnerLoginResult>>> {
  try {
    const body = (await request.json()) as Partial<OwnerLoginParams>;
    const { email, password } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message: "Se requiere un correo electrónico válido.",
        },
        { status: 400 },
      );
    }

    if (!password || typeof password !== "string" || password.length < 4) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message: "La contraseña debe tener al menos 4 caracteres.",
        },
        { status: 400 },
      );
    }

    const pool = getV2LocalPool();

    // Consultar usuario en auth.users y su empresa asociada
    const query = `
      SELECT 
        u.id AS owner_user_id,
        u.email,
        b.id AS business_id,
        b.commercial_name,
        b.legal_name,
        b.status AS business_status
      FROM auth.users u
      JOIN public.businesses b ON b.owner_user_id = u.id
      WHERE LOWER(u.email) = LOWER($1) AND b.status = 'active'
      LIMIT 1;
    `;

    const res = await pool.query(query, [email.trim()]);
    const row = res.rows[0];

    if (!row) {
      return NextResponse.json(
        {
          ok: false,
          code: "UNAUTHORIZED",
          message:
            "Credenciales inválidas. No se encontró un dueño activo con ese correo electrónico.",
        },
        { status: 401 },
      );
    }

    // Generar token firmado de sesión para el dueño
    const sessionToken = createOwnerSessionToken({
      ownerUserId: row.owner_user_id,
      businessId: row.business_id,
      expiresInSeconds: 24 * 60 * 60, // 24 horas
    });

    const responseData: OwnerLoginResult = {
      ownerUserId: row.owner_user_id,
      email: row.email,
      business: {
        id: row.business_id,
        commercialName: row.commercial_name,
        legalName: row.legal_name,
      },
      sessionToken,
    };

    const response = NextResponse.json(
      {
        ok: true as const,
        data: responseData,
      },
      { status: 200 },
    );

    // Inyectar cookie HttpOnly en la respuesta del navegador
    response.cookies.set({
      name: OWNER_SESSION_COOKIE,
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60,
    });

    return response;
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Error interno procesando autenticación del dueño.";
    return NextResponse.json(
      {
        ok: false,
        code: "INTERNAL_SERVER_ERROR",
        message,
      },
      { status: 500 },
    );
  }
}
