import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const { data, error } = await supabaseServer
            .from("shifts")
            .select(`
                *,
                shift_participants (
                    id,
                    user_id,
                    user_name,
                    system_role,
                    shift_role,
                    status,
                    joined_at,
                    left_at
                )
            `)
            .order("opened_at", { ascending: false });

        if (error) {
            throw new Error(error.message);
        }

        const shifts = data.map((shift) => ({
            id: shift.id,
            folio: shift.folio,
            status: shift.status,
            openedAt: shift.opened_at,
            closedAt: shift.closed_at,
            responsibleUserId: shift.responsible_user_id,
            responsibleUserName: shift.responsible_user_name,
            openingBalances: {
                cashPhysical: shift.opening_cash_physical,
                cashReserved: shift.opening_cash_reserved,
                banks: shift.opening_bank_balances || [],
            },
            participants: (shift.shift_participants || []).map((p: any) => ({
                id: p.id,
                userId: p.user_id,
                name: p.user_name,
                systemRole: p.system_role,
                shiftRole: p.shift_role,
                status: p.status,
                joinedAt: p.joined_at,
                leftAt: p.left_at,
            })),
            closing: shift.closing_status ? {
                status: shift.closing_status,
                closedAt: shift.closed_at,
                closedByUserId: shift.responsible_user_id, // Asumimos cierre por responsable asignado por ahora
                closedByUserName: shift.responsible_user_name,
                expectedCashPhysical: shift.closing_expected_cash,
                countedCashPhysical: shift.closing_counted_cash,
                expectedReservedCash: shift.closing_expected_reserved,
                countedReservedCash: shift.closing_counted_reserved,
                totalDifference: shift.closing_total_difference,
                banks: shift.closing_bank_balances || [],
                observations: shift.closing_observations || undefined,
            } : undefined
        }));

        return NextResponse.json({ ok: true, shifts });
    } catch (error) {
        console.error("Error fetching shifts:", error);
        return NextResponse.json(
            { ok: false, error: error instanceof Error ? error.message : "Error desconocido" },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Extraemos para armar un Snapshot según las interfaces
        const ob = body.openingBalances || {};

        // Smart payload extraction to support both nested Context and flattened view models
        const cashPhysical = ob.cash?.physicalBalance ?? ob.cashPhysical ?? 0;
        const cashReserved = ob.cash?.reservedOperations?.reduce((sum: number, res: any) => sum + res.amount, 0) ?? ob.cashReserved ?? 0;
        const bankBalances = ob.banks ? (
            Array.isArray(ob.banks) && ob.banks.length > 0 && 'bankName' in ob.banks[0]
                ? ob.banks.map((b: any) => ({
                    bankId: b.id || b.bankId,
                    bankName: b.bankName,
                    balance: b.realBalance ?? b.balance
                }))
                : []
        ) : [];

        const insertPayload = {
            folio: body.folio,
            status: "open",
            opened_at: body.openedAt || new Date().toISOString(),
            responsible_user_id: body.responsibleUserId,
            responsible_user_name: body.responsibleUserName,
            opening_cash_physical: cashPhysical,
            opening_cash_reserved: cashReserved,
            opening_bank_balances: bankBalances
        };

        const { data, error } = await supabaseServer
            .from("shifts")
            .insert(insertPayload)
            .select()
            .single();

        if (error) {
            throw new Error(error.message);
        }

        // Insertar responsable predeterminado al aperturar el turno
        const participantPayload = {
            shift_id: data.id,
            user_id: body.responsibleUserId,
            user_name: body.responsibleUserName,
            system_role: body.responsibleUserRole || "employee",
            shift_role: "shift_responsible",
            status: "active",
            joined_at: data.opened_at
        };
        const { error: participantError } = await supabaseServer
            .from("shift_participants")
            .insert(participantPayload);

        if (participantError) {
            console.error("No se pudo iniciar al participante", participantError);
        }

        const newShift = {
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
            }
        };

        return NextResponse.json({ ok: true, shift: newShift });
    } catch (error) {
        console.error("Error creating shift:", error);
        return NextResponse.json(
            { ok: false, error: error instanceof Error ? error.message : "Error desconocido" },
            { status: 500 }
        );
    }
}
