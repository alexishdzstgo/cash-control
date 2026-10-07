import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { syncBalancesForMovementUpdate } from "../../operations/financialPersistence";

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        // Eliminar 'id' de los campos a actualizar si viniera
        if (body.id) delete body.id;

        // Convertir camelCase a snake_case para la base de datos
        const updatePayload: Record<string, any> = {};
        for (const [key, value] of Object.entries(body)) {
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            updatePayload[snakeKey] = value;
        }

        // Fetch original movement before update
        const { data: originalData, error: originalError } = await supabaseServer
            .from("administrative_movements")
            .select("*")
            .eq("id", id)
            .single();

        if (originalError || !originalData) {
            throw new Error(originalError?.message || "Movement not found");
        }

        const { data, error } = await supabaseServer
            .from("administrative_movements")
            .update(updatePayload)
            .eq("id", id)
            .select()
            .single();

        if (error) {
            throw new Error(error.message);
        }

        const updatedMovement = {
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

        const oldMovement = {
            id: originalData.id,
            movementType: originalData.movement_type,
            resourceType: originalData.resource_type,
            resourceId: originalData.resource_id,
            resourceName: originalData.resource_name,
            amountCents: originalData.amount_cents,
            balanceBeforeCents: originalData.balance_before_cents,
            balanceAfterCents: originalData.balance_after_cents,
            explanation: originalData.explanation || undefined,
            status: originalData.status,
            createdByUserId: originalData.created_by_user_id,
            createdByUserName: originalData.created_by_user_name,
            createdAt: originalData.created_at,
            shiftId: originalData.shift_id || undefined,
            isEdited: originalData.is_edited,
            editedAt: originalData.edited_at || undefined,
            editedByUserId: originalData.edited_by_user_id || undefined,
            editedByUserName: originalData.edited_by_user_name || undefined,
            editReason: originalData.edit_reason || undefined,
            registeredResourceName: originalData.registered_resource_name || undefined,
            correctionBalances: originalData.correction_balances || undefined,
            previousAmountCents: originalData.previous_amount_cents || undefined,
            previousResourceId: originalData.previous_resource_id || undefined,
            previousResourceName: originalData.previous_resource_name || undefined,
            previousMovementType: originalData.previous_movement_type || undefined
        };

        // Sync bank or cash box balance for updates
        await syncBalancesForMovementUpdate(oldMovement as any, updatedMovement as any);

        return NextResponse.json({ ok: true, movement: updatedMovement });
    } catch (error) {
        console.error("Error patching movement:", error);
        return NextResponse.json(
            { ok: false, error: error instanceof Error ? error.message : "Error desconocido" },
            { status: 500 }
        );
    }
}
