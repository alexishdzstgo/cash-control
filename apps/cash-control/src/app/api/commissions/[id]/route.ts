import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const id = (await params).id;
        const body = await request.json();

        // Map camelCase keys to snake_case if they exist in the body
        const updatePayload: Record<string, any> = {};
        if (body.operationType !== undefined) updatePayload.operation_type = body.operationType;
        if (body.minAmountCents !== undefined) updatePayload.min_amount_cents = body.minAmountCents;
        if (body.maxAmountCents !== undefined) updatePayload.max_amount_cents = body.maxAmountCents;
        if (body.calculationType !== undefined) updatePayload.calculation_type = body.calculationType;
        if (body.fixedAmountCents !== undefined) updatePayload.fixed_amount_cents = body.fixedAmountCents;
        if (body.status !== undefined) updatePayload.status = body.status;
        if (body.version !== undefined) updatePayload.version = body.version;
        if (body.validFrom !== undefined) updatePayload.valid_from = body.validFrom;
        if (body.validTo !== undefined) updatePayload.valid_to = body.validTo;
        if (body.createdBy !== undefined) updatePayload.created_by = body.createdBy;
        if (body.replacedByRuleId !== undefined) updatePayload.replaced_by_rule_id = body.replacedByRuleId;
        if (body.hasBeenApplied !== undefined) updatePayload.has_been_applied = body.hasBeenApplied;

        updatePayload.updated_at = new Date().toISOString();

        const { data, error } = await supabaseServer
            .from("commission_rules")
            .update(updatePayload)
            .eq("id", id)
            .select()
            .single();

        if (error) throw new Error(error.message);

        const updatedRule = {
            id: data.id,
            operationType: data.operation_type,
            minAmountCents: data.min_amount_cents,
            maxAmountCents: data.max_amount_cents,
            calculationType: data.calculation_type,
            fixedAmountCents: data.fixed_amount_cents,
            status: data.status,
            version: data.version,
            validFrom: data.valid_from,
            validTo: data.valid_to,
            createdBy: data.created_by,
            replacedByRuleId: data.replaced_by_rule_id,
            hasBeenApplied: data.has_been_applied,
        };

        return NextResponse.json({ ok: true, rule: updatedRule });
    } catch (error) {
        console.error("Error updating commission rule:", error);
        return NextResponse.json(
            { ok: false, error: error instanceof Error ? error.message : "Error desconocido" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const id = (await params).id;

        // Perform hard delete
        const { error } = await supabaseServer
            .from("commission_rules")
            .delete()
            .eq("id", id);

        if (error) throw new Error(error.message);

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Error deleting commission rule:", error);
        return NextResponse.json(
            { ok: false, error: error instanceof Error ? error.message : "Error desconocido" },
            { status: 500 }
        );
    }
}
