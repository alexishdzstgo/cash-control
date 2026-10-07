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
                closing_expected_cash: typeof closing.expectedCashPhysical === 'number' ? closing.expectedCashPhysical : null,
                closing_counted_cash: typeof closing.countedCashPhysical === 'number' ? closing.countedCashPhysical : null,
                closing_expected_reserved: typeof closing.expectedReservedCash === 'number' ? closing.expectedReservedCash : null,
                closing_counted_reserved: typeof closing.countedReservedCash === 'number' ? closing.countedReservedCash : null,
                closing_total_difference: typeof closing.totalDifference === 'number' ? closing.totalDifference : null,
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

            // ------ APLICAR ARQUEO FÍSICO A TABLAS MAESTRAS ------

            // 1. Forzar real_balance de Caja Física
            if (typeof closing.countedCashPhysical === 'number') {
                const { data: cashBoxes } = await supabaseServer.from("cash_boxes").select("id").limit(1);
                if (cashBoxes && cashBoxes.length > 0) {
                    const { error } = await supabaseServer
                        .from("cash_boxes")
                        .update({ real_balance: closing.countedCashPhysical })
                        .eq("id", cashBoxes[0].id);

                    if (error) {
                        throw new Error(`No se pudo actualizar el saldo de caja física: ${error.message}`);
                    }
                }
            }

            // 2. Forzar real_balance de todos los Bancos contados
            if (Array.isArray(closing.banks)) {
                for (const bankCount of closing.banks) {
                    if (bankCount.bankId && typeof bankCount.countedBalance === 'number') {
                        const { error } = await supabaseServer
                            .from("bank_accounts")
                            .update({ real_balance: bankCount.countedBalance })
                            .eq("id", bankCount.bankId);

                        if (error) {
                            throw new Error(`No se pudo actualizar el saldo bancario: ${error.message}`);
                        }
                    }
                }
            }
            // -----------------------------------------------------

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
