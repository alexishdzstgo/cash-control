"use client";

import { formatCurrency } from "@/lib/formatters";

type ExpectedCashSummaryProps = {
  openingBalance: number;
  totalEntries: number;
  totalOutputs: number;
  expectedCash: number;
  reservedCash: number;
  availableCash: number;
};

export function ExpectedCashSummary({
  openingBalance,
  totalEntries,
  totalOutputs,
  expectedCash,
  reservedCash,
  availableCash,
}: ExpectedCashSummaryProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-400">
        Resumen de efectivo esperado
      </h3>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">Saldo inicial de caja</span>
          <span className="font-medium text-slate-900 tabular-nums">
            {formatCurrency(openingBalance)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">Entradas de efectivo</span>
          <span className="font-medium text-emerald-700 tabular-nums">
            +{formatCurrency(totalEntries)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">Salidas de efectivo</span>
          <span className="font-medium text-red-600 tabular-nums">
            &minus;{formatCurrency(totalOutputs)}
          </span>
        </div>

        <div className="border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-900">
              Efectivo esperado
            </span>
            <span className="text-lg font-bold text-slate-900 tabular-nums">
              {formatCurrency(expectedCash)}
            </span>
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-slate-50 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Efectivo reservado</span>
            <span className="font-medium text-amber-700 tabular-nums">
              {formatCurrency(reservedCash)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-slate-600">Disponible para operar</span>
            <span className="font-semibold text-slate-900 tabular-nums">
              {formatCurrency(availableCash)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}