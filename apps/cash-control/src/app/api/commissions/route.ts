import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const { data, error } = await supabaseServer
            .from("commission_rules")
            .select("*")
            .order("min_amount_cents", { ascending: true });

        if (error) {
            throw new Error(error.message);
        }

        const formattedRules = data.map((rule) => ({
            id: rule.id,
            operationType: rule.operation_type,
            minAmountCents: rule.min_amount_cents,
            maxAmountCents: rule.max_amount_cents,
            calculationType: rule.calculation_type,
            fixedAmountCents: rule.fixed_amount_cents,
            status: rule.status,
            version: rule.version,
            validFrom: rule.valid_from,
            validTo: rule.valid_to,
            createdBy: rule.created_by,
            replacedByRuleId: rule.replaced_by_rule_id,
            hasBeenApplied: rule.has_been_applied,
        }));

        return NextResponse.json({ ok: true, rules: formattedRules });
    } catch (error) {
        console.error("Error fetching commissions:", error);
        return NextResponse.json(
            { ok: false, error: "Ocurrió un error al consultar las comisiones." },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Convert the incoming camelCase rule to snake_case for Supabase
        // Optional: you can extract only the required fields
        const insertPayload = {
            operation_type: body.operationType,
            min_amount_cents: body.minAmountCents,
            max_amount_cents: body.maxAmountCents || null,
            calculation_type: body.calculationType || 'fixed',
            fixed_amount_cents: body.fixedAmountCents,
            status: body.status || 'active',
            version: body.version || 1,
            valid_from: body.validFrom || new Date().toISOString(),
            valid_to: body.validTo || null,
            created_by: body.createdBy || 'Sistema',
            replaced_by_rule_id: body.replacedByRuleId || null,
            has_been_applied: false
        };

        const { data, error } = await supabaseServer
            .from("commission_rules")
            .insert(insertPayload)
            .select()
            .single();

        if (error) throw new Error(error.message);

        // Convert back to camelCase for the frontend
        const newRule = {
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

        return NextResponse.json({ ok: true, rule: newRule });
    } catch (error) {
        console.error("Error creating commission rule:", error);
        return NextResponse.json(
            { ok: false, error: error instanceof Error ? error.message : "Error desconocido" },
            { status: 500 }
        );
    }
}
