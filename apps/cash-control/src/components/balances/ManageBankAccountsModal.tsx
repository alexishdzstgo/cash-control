"use client";

import { AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { ModalShell } from "@/components/shared/ModalShell";
import { useNotification } from "@/components/shared/NotificationProvider";
import { useBusinessFunds } from "@/components/business-funds/BusinessFundsContext";

export type BankAccountRow = {
    id: string;
    accountName: string;
    accountLastDigits: string;
    realBalance: number;
};

type BankAccountFormModalProps = {
    isOpen: boolean;
    onClose: () => void;
    accountToEdit?: BankAccountRow | null;
};

export function BankAccountFormModal({
    isOpen,
    onClose,
    accountToEdit,
}: BankAccountFormModalProps) {
    const { showSuccess, showError } = useNotification();
    const { refreshFinancialData } = useBusinessFunds();

    // Form state
    const [accountName, setAccountName] = useState("");
    const [accountLastDigits, setAccountLastDigits] = useState("");
    const [realBalance, setRealBalance] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (accountToEdit) {
                setAccountName(accountToEdit.accountName);
                setAccountLastDigits(accountToEdit.accountLastDigits);
                setRealBalance(accountToEdit.realBalance ? accountToEdit.realBalance.toString() : "0");
            } else {
                setAccountName("");
                setAccountLastDigits("");
                setRealBalance("0");
            }
        }
    }, [isOpen, accountToEdit]);

    async function handleSave() {
        if (!accountName.trim() || !accountLastDigits.trim()) {
            showError("Por favor llena todos los campos obligatorios.");
            return;
        }
        if (!/^\d{4}$/.test(accountLastDigits)) {
            showError("Los últimos 4 dígitos deben ser exactamente 4 números.");
            return;
        }

        setIsSubmitting(true);
        try {
            const method = accountToEdit ? "PATCH" : "POST";
            const url = accountToEdit ? `/api/banks/${accountToEdit.id}` : "/api/banks";

            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(
                    accountToEdit
                        ? {
                            accountName: accountName.trim(),
                            accountLastDigits: accountLastDigits.trim(),
                        }
                        : {
                            accountName: accountName.trim(),
                            accountLastDigits: accountLastDigits.trim(),
                            realBalance: parseFloat(realBalance || "0"),
                        }
                ),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "No se pudo guardar la cuenta.");
            }

            showSuccess(`Cuenta ${accountToEdit ? "actualizada" : "registrada"} con éxito.`);
            await refreshFinancialData();
            onClose();
        } catch (error) {
            showError(error instanceof Error ? error.message : "Error al conectar con el servidor.");
        } finally {
            setIsSubmitting(false);
        }
    }

    if (!isOpen) return null;

    return (
        <ModalShell
            title={accountToEdit ? "Editar cuenta bancaria" : "Agregar banco"}
            description="Llena los datos para continuar."
            onClose={onClose}
            maxWidth="sm"
            bodyClassName="bg-slate-50/50"
            footer={
                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        className="btn-secondary"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        className="btn-primary"
                        onClick={handleSave}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Guardando..." : "Guardar cuenta"}
                    </button>
                </div>
            }
        >
            <form className="space-y-4">
                <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Nombre de la cuenta (Banco)</label>
                    <input
                        type="text"
                        value={accountName}
                        onChange={e => setAccountName(e.target.value)}
                        className="field-input"
                        placeholder="Ej. BBVA Principal, Azteca..."
                        maxLength={50}
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Últimos 4 dígitos</label>
                    <input
                        type="text"
                        value={accountLastDigits}
                        onChange={e => setAccountLastDigits(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        className="field-input font-mono"
                        placeholder="0000"
                        maxLength={4}
                    />
                    <p className="text-xs text-slate-500">Obligatorio para conciliar depósitos.</p>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Saldo real</label>
                    <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <span className="text-slate-500 sm:text-sm">$</span>
                        </div>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={realBalance}
                            onChange={e => setRealBalance(e.target.value)}
                            className="field-input"
                            style={{ paddingLeft: '2.25rem' }}
                            placeholder="0.00"
                            disabled={!!accountToEdit}
                        />
                    </div>
                    {!!accountToEdit && (
                        <p className="text-xs text-amber-600 font-medium">
                            El saldo inicial no se puede editar después de crear la cuenta. Para ajustarlo, registra movimientos formales.
                        </p>
                    )}
                </div>
            </form>
        </ModalShell>
    );
}
