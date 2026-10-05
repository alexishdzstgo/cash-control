import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const accountId = (await params).id;
        if (!accountId) {
            return NextResponse.json(
                { ok: false, error: "ID de cuenta inválido." },
                { status: 400 },
            );
        }

        const body = await request.json();

        const accountName = typeof body.accountName === "string" ? body.accountName.trim() : undefined;
        const accountLastDigits = typeof body.accountLastDigits === "string" ? body.accountLastDigits.trim() : undefined;
        const realBalance = typeof body.realBalance === "number" ? body.realBalance : undefined;
        const status = body.status;

        const updates: Record<string, any> = {};

        if (accountName !== undefined) {
            if (!accountName) {
                return NextResponse.json({ ok: false, error: "El nombre de la cuenta es obligatorio." }, { status: 400 });
            }
            updates.account_name = accountName;
        }

        if (accountLastDigits !== undefined) {
            if (!/^\d{4}$/.test(accountLastDigits)) {
                return NextResponse.json({ ok: false, error: "Los últimos 4 dígitos deben ser exactamente 4 números." }, { status: 400 });
            }
            updates.account_last_digits = accountLastDigits;
        }

        if (status !== undefined) {
            if (status !== "active" && status !== "inactive") {
                return NextResponse.json({ ok: false, error: "El estado proporcionado no es válido." }, { status: 400 });
            }
            updates.status = status;
        }

        if (realBalance !== undefined) {
            // Enforce valid numbers (>= 0 typically for accounts, but we'll allow standard numeric assignment)
            updates.real_balance = realBalance;
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json(
                { ok: false, error: "No se enviaron datos para actualizar." },
                { status: 400 },
            );
        }

        const { data: updatedAccount, error: updateError } = await supabaseServer
            .from("bank_accounts")
            .update(updates)
            .eq("id", accountId)
            .select()
            .maybeSingle();

        if (updateError) {
            throw new Error(updateError.message);
        }

        if (!updatedAccount) {
            return NextResponse.json(
                { ok: false, error: "Cuenta bancaria no encontrada." },
                { status: 404 },
            );
        }

        return NextResponse.json(
            {
                ok: true,
                account: {
                    id: updatedAccount.id,
                    accountName: updatedAccount.account_name,
                    accountLastDigits: updatedAccount.account_last_digits,
                    status: updatedAccount.status,
                    createdAt: updatedAccount.created_at,
                    realBalance: updatedAccount.real_balance,
                    reservedBalance: updatedAccount.reserved_balance,
                    availableBalance: updatedAccount.available_balance,
                },
                message: "Cuenta actualizada correctamente.",
            },
            { status: 200 },
        );
    } catch (error) {
        return NextResponse.json(
            {
                ok: false,
                error: error instanceof Error ? error.message : "Ocurrió un error al actualizar la cuenta.",
            },
            { status: 500 },
        );
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const accountId = (await params).id;
        if (!accountId) {
            return NextResponse.json(
                { ok: false, error: "ID de cuenta inválido." },
                { status: 400 },
            );
        }

        const { error: deleteError } = await supabaseServer
            .from("bank_accounts")
            .delete()
            .eq("id", accountId);

        if (deleteError) {
            throw new Error(deleteError.message);
        }

        return NextResponse.json(
            {
                ok: true,
                message: "Cuenta bancaria eliminada correctamente.",
            },
            { status: 200 },
        );
    } catch (error) {
        return NextResponse.json(
            {
                ok: false,
                error: error instanceof Error ? error.message : "Ocurrió un error al eliminar la cuenta.",
            },
            { status: 500 },
        );
    }
}

