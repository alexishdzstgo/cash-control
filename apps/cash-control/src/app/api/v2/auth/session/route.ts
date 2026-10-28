import { NextResponse } from "next/server";
import { getAuthenticatedOwner } from "@/lib/api-v2/server/auth";
import { getV2LocalPool } from "@/lib/api-v2/server/db";
import type { OwnerSessionInfo, V2ApiResponse } from "@/lib/api-v2/types";

export async function GET(
  request: Request,
): Promise<NextResponse<V2ApiResponse<OwnerSessionInfo | null>>> {
  try {
    const ownerSession = await getAuthenticatedOwner(request);
    if (!ownerSession) {
      return NextResponse.json(
        {
          ok: true as const,
          data: null,
        },
        { status: 200 },
      );
    }

    const pool = getV2LocalPool();
    const query = `
      SELECT 
        u.email,
        b.id AS business_id,
        b.commercial_name,
        b.legal_name
      FROM public.businesses b
      JOIN auth.users u ON u.id = b.owner_user_id
      WHERE b.id = $1 AND b.owner_user_id = $2
      LIMIT 1;
    `;

    const res = await pool.query(query, [
      ownerSession.businessId,
      ownerSession.ownerUserId,
    ]);
    const row = res.rows[0];

    if (!row) {
      return NextResponse.json(
        {
          ok: true as const,
          data: null,
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        ok: true as const,
        data: {
          ownerUserId: ownerSession.ownerUserId,
          email: row.email,
          businessId: ownerSession.businessId,
          business: {
            id: row.business_id,
            commercialName: row.commercial_name,
            legalName: row.legal_name,
          },
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Error consultando sesión del dueño.";
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
