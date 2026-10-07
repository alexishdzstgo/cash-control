import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const { data, error } = await supabaseServer
            .from("cash_boxes")
            .select("*")
            .order("created_at", { ascending: true });

        if (error) {
            throw new Error(error.message);
        }

        const cashBoxes = data.map((box) => ({
            id: box.id,
            name: box.name,
            realBalance: box.real_balance,
            lowBalanceThreshold: box.low_balance_threshold,
            criticalBalanceThreshold: box.critical_balance_threshold,
            status: box.status,
            createdAt: box.created_at,
            updatedAt: box.updated_at
        }));

        return NextResponse.json({ ok: true, cashBoxes });
    } catch (error) {
        console.error("Error fetching cash_boxes:", error);
        return NextResponse.json(
            { ok: false, error: error instanceof Error ? error.message : "Error desconocido" },
            { status: 500 }
        );
    }
}
