import { supabaseServer } from "@/lib/supabase/server";
import { getOperationFinancialImpact } from "@/lib/finance";
import type { Operation } from "@/types/operation";
import type { AdministrativeMovement } from "@/types/administrativeMovement";

export async function syncBalancesForOperationInsert(newOp: Operation) {
    const impact = getOperationFinancialImpact(newOp);

    for (const delta of impact.bankDeltas) {
        if (delta.amount !== 0) {
            await applyBankDelta(delta.bankId, delta.amount);
        }
    }

    if (impact.cashDelta !== 0) {
        const { data: boxes } = await supabaseServer.from("cash_boxes").select("id").limit(1);
        if (boxes && boxes.length > 0) {
            await applyCashBoxDelta(boxes[0].id, impact.cashDelta);
        }
    }
}

export async function syncBalancesForOperationUpdate(oldOp: Operation, newOp: Operation) {
    const oldImpact = getOperationFinancialImpact(oldOp);
    const newImpact = getOperationFinancialImpact(newOp);

    // Map to accumulate net changes per bank
    const netChanges = new Map<string, number>();

    // Reverse the old impact
    for (const delta of oldImpact.bankDeltas) {
        if (delta.amount !== 0) {
            netChanges.set(delta.bankId, (netChanges.get(delta.bankId) || 0) - delta.amount);
        }
    }

    // Apply the new impact
    for (const delta of newImpact.bankDeltas) {
        if (delta.amount !== 0) {
            netChanges.set(delta.bankId, (netChanges.get(delta.bankId) || 0) + delta.amount);
        }
    }

    for (const [bankId, amount] of Array.from(netChanges.entries())) {
        if (amount !== 0) {
            await applyBankDelta(bankId, amount);
        }
    }

    const netCashChange = newImpact.cashDelta - oldImpact.cashDelta;
    if (netCashChange !== 0) {
        const { data: boxes } = await supabaseServer.from("cash_boxes").select("id").limit(1);
        if (boxes && boxes.length > 0) {
            await applyCashBoxDelta(boxes[0].id, netCashChange);
        }
    }
}

async function applyBankDelta(bankId: string, amount: number) {
    try {
        const { data: bankData, error: fetchError } = await supabaseServer
            .from("bank_accounts")
            .select("real_balance")
            .eq("id", bankId)
            .single();

        if (fetchError || !bankData) {
            console.error(`Error fetching bank account ${bankId} for balance sync:`, fetchError);
            return;
        }

        const newBalance = bankData.real_balance + amount;

        const { error: updateError } = await supabaseServer
            .from("bank_accounts")
            .update({ real_balance: newBalance })
            .eq("id", bankId);

        if (updateError) {
            console.error(`Error updating bank account ${bankId} real_balance:`, updateError);
        }
    } catch (e) {
        console.error("Failed to apply bank delta in DB", e);
    }
}

export async function syncBalancesForMovementInsert(movement: AdministrativeMovement) {
    const isIncome = movement.movementType === "income";
    const amountFloat = movement.amountCents / 100;
    const delta = isIncome ? amountFloat : -amountFloat;

    if (delta !== 0) {
        if (movement.resourceType === "bank") {
            await applyBankDelta(movement.resourceId, delta);
        } else if (movement.resourceType === "cash") {
            await applyCashBoxDelta(movement.resourceId, delta);
        }
    }
}

export async function syncBalancesForMovementUpdate(oldMovement: AdministrativeMovement, newMovement: AdministrativeMovement) {
    const oldIsIncome = oldMovement.movementType === "income";
    const oldAmountFloat = oldMovement.amountCents / 100;
    const oldDelta = oldIsIncome ? oldAmountFloat : -oldAmountFloat;

    const newIsIncome = newMovement.movementType === "income";
    const newAmountFloat = newMovement.amountCents / 100;
    const newDelta = newIsIncome ? newAmountFloat : -newAmountFloat;

    // Build absolute deltas by resource ID
    const deltas = new Map<string, { type: "bank" | "cash", delta: number }>();

    // Undo old movement
    if (oldDelta !== 0) {
        deltas.set(oldMovement.resourceId, {
            type: oldMovement.resourceType,
            delta: -oldDelta
        });
    }

    // Apply new movement
    if (newDelta !== 0) {
        const current = deltas.get(newMovement.resourceId) || { type: newMovement.resourceType, delta: 0 };
        current.delta += newDelta;
        current.type = newMovement.resourceType; // Override just in case type changed though it shouldn't
        deltas.set(newMovement.resourceId, current);
    }

    // Process all combined deltas
    for (const [resourceId, config] of Array.from(deltas.entries())) {
        if (config.delta !== 0) {
            if (config.type === "bank") {
                await applyBankDelta(resourceId, config.delta);
            } else if (config.type === "cash") {
                await applyCashBoxDelta(resourceId, config.delta);
            }
        }
    }
}

async function applyCashBoxDelta(boxId: string, amount: number) {
    try {
        const { data: boxData, error: fetchError } = await supabaseServer
            .from("cash_boxes")
            .select("real_balance")
            .eq("id", boxId)
            .single();

        if (fetchError || !boxData) {
            console.error(`Error fetching cash box ${boxId} for balance sync:`, fetchError);
            return;
        }

        const newBalance = boxData.real_balance + amount;

        const { error: updateError } = await supabaseServer
            .from("cash_boxes")
            .update({ real_balance: newBalance })
            .eq("id", boxId);

        if (updateError) {
            console.error(`Error updating cash box ${boxId} real_balance:`, updateError);
        }
    } catch (e) {
        console.error("Failed to apply cash box delta in DB", e);
    }
}
