import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { syncBalancesForMovementInsert } from "../operations/financialPersistence";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const shiftId = searchParams.get('shiftId'); // Opcional, para filtrar por turno

        let query = supabaseServer
            .from("administrative_movements")
            .select("*")
            .order("created_at", { ascending: false });

        if (shiftId) {
            query = query.eq("shift_id", shiftId);
        }

        const { data, error } = await query;

        if (error) {
            throw new Error(error.message);
        }

        const movements = data.map((item) => ({
            id: item.id,
            movementType: item.movement_type,
            resourceType: item.resource_type,
            resourceId: item.resource_id,
            resourceName: item.resource_name,
            amountCents: item.amount_cents,
            balanceBeforeCents: item.balance_before_cents,
            balanceAfterCents: item.balance_after_cents,
            explanation: item.explanation || undefined,
            status: item.status,
            createdByUserId: item.created_by_user_id,
            createdByUserName: item.created_by_user_name,
            createdAt: item.created_at,
            shiftId: item.shift_id || undefined,
            isEdited: item.is_edited,
            editedAt: item.edited_at || undefined,
            editedByUserId: item.edited_by_user_id || undefined,
            editedByUserName: item.edited_by_user_name || undefined,
            editReason: item.edit_reason || undefined,
            registeredResourceName: item.registered_resource_name || undefined,
            correctionBalances: item.correction_balances || undefined,
            previousAmountCents: item.previous_amount_cents || undefined,
            previousResourceId: item.previous_resource_id || undefined,
            previousResourceName: item.previous_resource_name || undefined,
            previousMovementType: item.previous_movement_type || undefined
        }));

        return NextResponse.json({ ok: true, movements });
    } catch (error) {
        console.error("Error fetching movements:", error);
        return NextResponse.json(
            { ok: false, error: error instanceof Error ? error.message : "Error desconocido" },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const insertPayload = {
            shift_id: body.shiftId,
            movement_type: body.movementType,
            resource_type: body.resourceType,
            resource_id: body.resourceId,
            resource_name: body.resourceName,
            amount_cents: body.amountCents,
            balance_before_cents: body.balanceBeforeCents,
            balance_after_cents: body.balanceAfterCents,
            explanation: body.explanation,
            status: body.status || "active",
            created_at: body.createdAt || new Date().toISOString(),
            created_by_user_id: body.createdByUserId,
            created_by_user_name: body.createdByUserName,
            is_edited: body.isEdited || false,
        };

        const { data, error } = await supabaseServer
            .from("administrative_movements")
            .insert(insertPayload)
            .select()
            .single();

        if (error) {
            throw new Error(error.message);
        }

        const newMovement = {
            id: data.id,
            movementType: data.movement_type,
            resourceType: data.resource_type,
            resourceId: data.resource_id,
            resourceName: data.resource_name,
            amountCents: data.amount_cents,
            balanceBeforeCents: data.balance_before_cents,
            balanceAfterCents: data.balance_after_cents,
            explanation: data.explanation || undefined,
            status: data.status,
            createdByUserId: data.created_by_user_id,
            createdByUserName: data.created_by_user_name,
            createdAt: data.created_at,
            shiftId: data.shift_id || undefined,
            isEdited: data.is_edited,
            editedAt: data.edited_at || undefined,
            editedByUserId: data.edited_by_user_id || undefined,
            editedByUserName: data.edited_by_user_name || undefined,
            editReason: data.edit_reason || undefined,
            registeredResourceName: data.registered_resource_name || undefined,
            correctionBalances: data.correction_balances || undefined,
            previousAmountCents: data.previous_amount_cents || undefined,
            previousResourceId: data.previous_resource_id || undefined,
            previousResourceName: data.previous_resource_name || undefined,
            previousMovementType: data.previous_movement_type || undefined
        };

        // Sincronizar saldos de resource base (Caja fisica o Bancos)
        await syncBalancesForMovementInsert(newMovement as any);

        return NextResponse.json({ ok: true, movement: newMovement });
    } catch (error) {
        console.error("Error creating movement:", error);
        return NextResponse.json(
            { ok: false, error: error instanceof Error ? error.message : "Error desconocido" },
            { status: 500 }
        );
    }
}
