import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
    const { data, error } = await supabaseServer
        .from("bank_accounts")
        .select("id, account_name, account_last_digits, status, created_at, real_balance, reserved_balance, available_balance")
        .order("created_at", { ascending: true });

    if (error) {
        return NextResponse.json(
            { ok: false, error: error.message },
            { status: 500 },
        );
    }

    const accounts = data.map((acc) => ({
        id: acc.id,
        accountName: acc.account_name,
        accountLastDigits: acc.account_last_digits,
        status: acc.status,
        createdAt: acc.created_at,
        realBalance: acc.real_balance,
        reservedBalance: acc.reserved_balance,
        availableBalance: acc.available_balance,
    }));

    return NextResponse.json({
        ok: true,
        accounts,
    });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const accountName = typeof body.accountName === "string" ? body.accountName.trim() : "";
        const accountLastDigits = typeof body.accountLastDigits === "string" ? body.accountLastDigits.trim() : "";
        const realBalance = typeof body.realBalance === "number" ? body.realBalance : 0;

        // Status is always active on creation as requested by user
        const status = "active";

        if (!accountName) {
            return NextResponse.json(
                { ok: false, error: "El nombre de la cuenta es obligatorio." },
                { status: 400 },
            );
        }

        if (!/^\d{4}$/.test(accountLastDigits)) {
            return NextResponse.json(
                { ok: false, error: "Los últimos 4 dígitos deben ser exactamente 4 números." },
                { status: 400 },
            );
        }

        const { data: newAccount, error: createError } = await supabaseServer
            .from("bank_accounts")
            .insert({
                account_name: accountName,
                account_last_digits: accountLastDigits,
                real_balance: realBalance,
                status: status,
            })
            .select()
            .maybeSingle();

        if (createError) {
            throw new Error(createError.message);
        }

        return NextResponse.json(
            {
                ok: true,
                account: {
                    id: newAccount.id,
                    accountName: newAccount.account_name,
                    accountLastDigits: newAccount.account_last_digits,
                    status: newAccount.status,
                    createdAt: newAccount.created_at,
                    realBalance: newAccount.real_balance,
                    reservedBalance: newAccount.reserved_balance,
                    availableBalance: newAccount.available_balance,
                },
                message: "Cuenta registrada correctamente.",
            },
            { status: 201 },
        );
    } catch (error) {
        return NextResponse.json(
            {
                ok: false,
                error: error instanceof Error ? error.message : "Ocurrió un error al crear la cuenta.",
            },
            { status: 500 },
        );
    }
}