"use client";

import { useState } from "react";
import { useMockSession } from "@/components/session/MockSessionContext";
import { ModalShell } from "@/components/shared/ModalShell";
import { computeFinancialTotalsFromBalances } from "@/lib/finance";
import { formatCurrency } from "@/lib/formatters";
import {
  getNextShiftFolio,
  getShiftResponsible,
  validateShiftOpening,
} from "@/lib/shifts";
import type { BankAccountBalance, CashBalance } from "@/types/balance";

import { useShift } from "./ShiftContext";

export function StartShiftModal({
  cash,
  banks,
  onClose,
}: {
  cash: CashBalance;
  banks: BankAccountBalance[];
  onClose: () => void;
}) {
  const { participants } = useMockSession();

  const { shifts, canStartShift, startShift } = useShift();

  const [error, setError] = useState<string | null>(null);

  const totals = computeFinancialTotalsFromBalances({ cash, banks });

  const folio = getNextShiftFolio(shifts);

  const validationError = validateShiftOpening({ cash, banks });

  function confirm() {
    const result = startShift({ cash, banks });

    if (!result.success) {
      setError(result.error ?? "No se pudo iniciar el turno.");
      return;
    }

    onClose();
  }

  return (
    <ModalShell
      title="Nuevo turno"
      description="El turno iniciará con los saldos actuales. Estos importes son informativos."
      onClose={onClose}
      maxWidth="md"
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            onClick={confirm}
            disabled={!canStartShift() || Boolean(validationError)}
          >
            Iniciar {folio}
          </button>
        </div>
      }
    >
      <dl className="space-y-4 text-sm">
        <div>
          <dt className="text-slate-500">Responsable</dt>
          <dd className="mt-1 font-semibold text-slate-900">
            {getShiftResponsible(participants)?.userName ?? "Sin responsable"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Caja física inicial</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
            {formatCurrency(totals.cashPhysical)}
          </dd>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-slate-500">Disponible</dt>
            <dd
              className={`mt-1 font-semibold tabular-nums ${totals.cashAvailable < 0 ? "text-red-700" : "text-slate-900"}`}
            >
              {formatCurrency(totals.cashAvailable)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Apartado</dt>
            <dd className="mt-1 font-semibold tabular-nums text-slate-900">
              {formatCurrency(totals.cashReserved)}
            </dd>
          </div>
        </div>
      </dl>
      {totals.cashAvailable < 0 && (
        <p className="mt-4 text-sm text-amber-800">
          Existe un faltante de efectivo respecto al dinero apartado. El turno
          puede iniciar para que el responsable regularice los fondos.
        </p>
      )}
      <h3 className="mb-3 mt-6 text-sm font-semibold text-slate-900">Bancos</h3>
      <dl className="space-y-3 text-sm">
        {banks.map((bank) => (
          <div key={bank.id} className="flex justify-between gap-4">
            <dt className="text-slate-600">{bank.bankName}</dt>
            <dd className="font-semibold tabular-nums text-slate-900">
              {formatCurrency(bank.realBalance)}
            </dd>
          </div>
        ))}
      </dl>
      {(error || validationError || !canStartShift()) && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error ??
            validationError ??
            "Solo el responsable actual puede iniciar un turno."}
        </p>
      )}
    </ModalShell>
  );
}
