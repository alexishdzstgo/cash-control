import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: shiftId } = await params;
        const body = await request.json();

        // Si la petición trae un objeto `closing`, significa que están cerrando el turno
        if (body.closing) {
            const closing = body.closing;
            const updatePayload = {
                status: "closed",
                closed_at: closing.closedAt || new Date().toISOString(),
                closing_status: closing.status,
                closing_expected_cash: closing.expectedCashPhysical,
                closing_counted_cash: closing.countedCashPhysical,
                closing_expected_reserved: closing.expectedReservedCash,
                closing_counted_reserved: closing.countedReservedCash,
                closing_total_difference: closing.totalDifference,
                closing_bank_balances: closing.banks || [],
                closing_observations: closing.observations || null
            };

            const { data, error } = await supabaseServer
                .from("shifts")
                .update(updatePayload)
                .eq("id", shiftId)
                .select()
                .single();

            if (error) throw new Error(error.message);

            // Regresamos el objeto en la misma estructura del View Model
            const shiftResponse = {
                id: data.id,
                folio: data.folio,
                status: data.status,
                openedAt: data.opened_at,
                closedAt: data.closed_at,
                responsibleUserId: data.responsible_user_id,
                responsibleUserName: data.responsible_user_name,
                openingBalances: {
                    cashPhysical: data.opening_cash_physical,
                    cashReserved: data.opening_cash_reserved,
                    banks: data.opening_bank_balances || [],
                },
                closing: {
                    status: data.closing_status,
                    closedAt: data.closed_at,
                    closedByUserId: data.responsible_user_id,
                    closedByUserName: data.responsible_user_name,
                    expectedCashPhysical: data.closing_expected_cash,
                    countedCashPhysical: data.closing_counted_cash,
                    expectedReservedCash: data.closing_expected_reserved,
                    countedReservedCash: data.closing_counted_reserved,
                    totalDifference: data.closing_total_difference,
                    banks: data.closing_bank_balances || [],
                    observations: data.closing_observations || undefined,
                }
            };

            return NextResponse.json({ ok: true, shift: shiftResponse });
        }

        return NextResponse.json({ ok: false, error: "Solicitud de parche no reconocida." }, { status: 400 });

    } catch (error) {
        console.error("Error actualizando shift:", error);
        return NextResponse.json(
            { ok: false, error: error instanceof Error ? error.message : "Error desconocido" },
            { status: 500 }
        );
    }
}
