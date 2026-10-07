import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { syncBalancesForOperationInsert } from "./financialPersistence";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const shiftId = searchParams.get('shiftId'); // Opcional

        let query = supabaseServer
            .from("operations")
            .select("*")
            .order("created_at", { ascending: false });

        if (shiftId) {
            query = query.eq("shift_id", shiftId);
        }

        const { data, error } = await query;

        if (error) {
            throw new Error(error.message);
        }

        const operations = data.map((item) => ({
            id: item.id,
            shiftId: item.shift_id || undefined,
            type: item.type,
            status: item.status,
            bankFolio: item.bank_folio || "",
            amount: item.amount,
            commission: item.commission,
            total: item.total,
            appliedCommissionSnapshot: item.applied_commission_snapshot || undefined,
            commissionLocation: item.commission_location || undefined,
            commissionStatus: item.commission_status || undefined,
            senderName: item.sender_name,
            receiverName: item.receiver_name,
            bankFrom: item.bank_from || undefined,
            bankTo: item.bank_to || undefined,
            bankResourceId: item.bank_resource_id || undefined,
            destinationReference: item.destination_reference || undefined,
            destinationAccountLast4: item.destination_account_last4 || undefined,
            deliveryMethod: item.delivery_method || undefined,
            withdrawalCommissionMode: item.withdrawal_commission_mode || undefined,
            customerCashReceived: item.customer_cash_received || undefined,
            bankMovementAmount: item.bank_movement_amount || undefined,
            pendingReason: item.pending_reason || undefined,
            pendingReasonDetails: item.pending_reason_details || undefined,
            observations: item.observations || undefined,
            createdAt: item.created_at,
            createdBy: item.created_by,
            createdByUserId: item.created_by_user_id || undefined,
            pendingDelivery: item.pending_delivery || undefined,
            isEdited: item.is_edited,
            editedAt: item.edited_at || undefined,
            editedBy: item.edited_by || undefined,
            clarifications: item.clarifications || undefined,
            corrections: item.corrections || undefined
        }));

        return NextResponse.json({ ok: true, operations });
    } catch (error) {
        console.error("Error fetching operations:", error);
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
            type: body.type,
            status: body.status,
            bank_folio: body.bankFolio,
            amount: body.amount,
            commission: body.commission,
            total: body.total,
            applied_commission_snapshot: body.appliedCommissionSnapshot,
            commission_location: body.commissionLocation,
            commission_status: body.commissionStatus,
            sender_name: body.senderName,
            receiver_name: body.receiverName,
            bank_from: body.bankFrom,
            bank_to: body.bankTo,
            bank_resource_id: body.bankResourceId,
            destination_reference: body.destinationReference,
            destination_account_last4: body.destinationAccountLast4,
            delivery_method: body.deliveryMethod,
            withdrawal_commission_mode: body.withdrawalCommissionMode,
            customer_cash_received: body.customerCashReceived,
            bank_movement_amount: body.bankMovementAmount,
            pending_reason: body.pendingReason,
            pending_reason_details: body.pendingReasonDetails,
            observations: body.observations,
            created_at: body.createdAt || new Date().toISOString(),
            created_by: body.createdBy,
            created_by_user_id: body.createdByUserId,
            pending_delivery: body.pendingDelivery,
            is_edited: body.isEdited || false
        };

        const { data, error } = await supabaseServer
            .from("operations")
            .insert(insertPayload)
            .select()
            .single();

        if (error) {
            throw new Error(error.message);
        }

        const newOperation = {
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

        await syncBalancesForOperationInsert(newOperation as any);

        return NextResponse.json({ ok: true, operation: newOperation });
    } catch (error) {
        console.error("Error creating operation:", error);
        return NextResponse.json(
            { ok: false, error: error instanceof Error ? error.message : "Error desconocido" },
            { status: 500 }
        );
    }
}
