import { NextResponse } from "next/server";
import { getAuthenticatedOwner } from "@/lib/api-v2/server/auth";
import { getV2LocalPool } from "@/lib/api-v2/server/db";
import type { BusinessMemberItem, V2ApiResponse } from "@/lib/api-v2/types";

export async function GET(
  request: Request,
): Promise<NextResponse<V2ApiResponse<BusinessMemberItem[]>>> {
  try {
    const ownerSession = await getAuthenticatedOwner(request);
    if (!ownerSession) {
      return NextResponse.json(
        {
          ok: false,
          code: "UNAUTHORIZED",
          message:
            "No autenticado. Se requiere una sesión válida del dueño en el servidor.",
        },
        { status: 401 },
      );
    }

    const pool = getV2LocalPool();

    // Consultar exclusivamente miembros de la empresa perteneciente al dueño autenticado
    const query = `
      SELECT 
        bm.id,
        bm.full_name AS "fullName",
        bm.role,
        bm.status
      FROM public.business_members bm
      WHERE bm.business_id = $1 AND bm.status = 'active'
      ORDER BY (bm.role = 'owner') DESC, bm.full_name ASC;
    `;

    const res = await pool.query(query, [ownerSession.businessId]);

    const members: BusinessMemberItem[] = res.rows.map((row) => ({
      id: row.id,
      fullName: row.fullName,
      role: row.role,
      status: row.status,
    }));

    return NextResponse.json(
      {
        ok: true as const,
        data: members,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Error consultando miembros de la empresa.";
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
