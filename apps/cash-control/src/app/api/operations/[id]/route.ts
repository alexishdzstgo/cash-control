import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { syncBalancesForOperationUpdate } from "../financialPersistence";

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

        // Fetch original operation before update
        const { data: originalData, error: originalError } = await supabaseServer
            .from("operations")
            .select("*")
            .eq("id", id)
            .single();

        if (originalError || !originalData) {
            throw new Error(originalError?.message || "Operation not found");
        }

        const { data, error } = await supabaseServer
            .from("operations")
            .update(updatePayload)
            .eq("id", id)
            .select()
            .single();

        if (error) {
            throw new Error(error.message);
        }

        const updatedOperation = {
            id: data.id,
            shiftId: data.shift_id || undefined,
            type: data.type,
            status: data.status,
            bankFolio: data.bank_folio || "",
            amount: data.amount,
            commission: data.commission,
            total: data.total,
            appliedCommissionSnapshot: data.applied_commission_snapshot || undefined,
            commissionLocation: data.commission_location || undefined,
            commissionStatus: data.commission_status || undefined,
            senderName: data.sender_name,
            receiverName: data.receiver_name,
            bankFrom: data.bank_from || undefined,
            bankTo: data.bank_to || undefined,
            bankResourceId: data.bank_resource_id || undefined,
            destinationReference: data.destination_reference || undefined,
            destinationAccountLast4: data.destination_account_last4 || undefined,
            deliveryMethod: data.delivery_method || undefined,
            withdrawalCommissionMode: data.withdrawal_commission_mode || undefined,
            customerCashReceived: data.customer_cash_received || undefined,
            bankMovementAmount: data.bank_movement_amount || undefined,
            pendingReason: data.pending_reason || undefined,
            pendingReasonDetails: data.pending_reason_details || undefined,
            observations: data.observations || undefined,
            createdAt: data.created_at,
            createdBy: data.created_by,
            createdByUserId: data.created_by_user_id || undefined,
            pendingDelivery: data.pending_delivery || undefined,
            isEdited: data.is_edited,
            editedAt: data.edited_at || undefined,
            editedBy: data.edited_by || undefined,
            clarifications: data.clarifications || undefined,
            corrections: data.corrections || undefined
        };


        // Sincronizar el saldo real de banco para correcciones (diff entre Old y New)
        const oldOperation = {
            id: originalData.id,
            shiftId: originalData.shift_id || undefined,
            type: originalData.type,
            status: originalData.status,
            bankFolio: originalData.bank_folio || "",
            amount: originalData.amount,
            commission: originalData.commission,
            total: originalData.total,
            appliedCommissionSnapshot: originalData.applied_commission_snapshot || undefined,
            commissionLocation: originalData.commission_location || undefined,
            commissionStatus: originalData.commission_status || undefined,
            senderName: originalData.sender_name,
            receiverName: originalData.receiver_name,
            bankFrom: originalData.bank_from || undefined,
            bankTo: originalData.bank_to || undefined,
            bankResourceId: originalData.bank_resource_id || undefined,
            destinationReference: originalData.destination_reference || undefined,
            destinationAccountLast4: originalData.destination_account_last4 || undefined,
            deliveryMethod: originalData.delivery_method || undefined,
            withdrawalCommissionMode: originalData.withdrawal_commission_mode || undefined,
            customerCashReceived: originalData.customer_cash_received || undefined,
            bankMovementAmount: originalData.bank_movement_amount || undefined,
            pendingReason: originalData.pending_reason || undefined,
            pendingReasonDetails: originalData.pending_reason_details || undefined,
            observations: originalData.observations || undefined,
            createdAt: originalData.created_at,
            createdBy: originalData.created_by,
            createdByUserId: originalData.created_by_user_id || undefined,
            pendingDelivery: originalData.pending_delivery || undefined,
            isEdited: originalData.is_edited,
            editedAt: originalData.edited_at || undefined,
            editedBy: originalData.edited_by || undefined,
            clarifications: originalData.clarifications || undefined,
            corrections: originalData.corrections || undefined
        };
        await syncBalancesForOperationUpdate(oldOperation as any, updatedOperation as any);

        return NextResponse.json({ ok: true, operation: updatedOperation });
    } catch (error) {
        console.error("Error patching operation:", error);
        return NextResponse.json(
            { ok: false, error: error instanceof Error ? error.message : "Error desconocido" },
            { status: 500 }
        );
    }
}
