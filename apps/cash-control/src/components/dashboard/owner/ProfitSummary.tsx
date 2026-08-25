"use client";

import { Landmark, TrendingUp, Wallet } from "lucide-react";
import { useBusinessFunds } from "@/components/business-funds/BusinessFundsContext";
import { formatCurrency } from "@/lib/formatters";
import { demoDataNotice, profitHistory } from "./ownerDashboardMockData";

export function ProfitSummary() {
  const { operations } = useBusinessFunds();
  // Ganancia estimada derivada únicamente de comisiones de operaciones completadas
  const completedOperations = operations.filter(
    (operation) => operation.status === "entregado",
  );

  const totalCommission = completedOperations.reduce(
    (sum, operation) => sum + operation.commission,
    0,
  );

  const cashCommissions = completedOperations
    .filter((operation) => operation.bankTo === "Efectivo")
    .reduce((sum, operation) => sum + operation.commission, 0);

  const bankCommissions = completedOperations
    .filter((operation) => operation.bankTo !== "Efectivo")
    .reduce((sum, operation) => sum + operation.commission, 0);

  const depositCommissions = completedOperations
    .filter((operation) => operation.type === "deposito")
    .reduce((sum, operation) => sum + operation.commission, 0);

  const withdrawalCommissions = completedOperations
    .filter((operation) => operation.type === "retiro")
    .reduce((sum, operation) => sum + operation.commission, 0);

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Ganancia estimada
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Derivada de comisiones de operaciones entregadas
            </p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <TrendingUp className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>

        <p className="mt-4 amount-secondary text-slate-900">
          {formatCurrency(totalCommission)}
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <p className="text-xs text-slate-500">En caja física</p>
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-900 tabular-nums">
              {formatCurrency(cashCommissions)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <p className="text-xs text-slate-500">En bancos</p>
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-900 tabular-nums">
              {formatCurrency(bankCommissions)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <p className="text-xs text-slate-500">Comisiones de depósitos</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 tabular-nums">
              {formatCurrency(depositCommissions)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <p className="text-xs text-slate-500">Comisiones de retiros</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 tabular-nums">
              {formatCurrency(withdrawalCommissions)}
            </p>
          </div>
        </div>

        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
          <span>{demoDataNotice.label}</span>
          <span aria-hidden="true">·</span>
          <span>Datos simulados en desarrollo</span>
        </p>
      </div>

      <div className="px-6 py-5">
        <h3 className="text-sm font-semibold text-slate-900">
          Histórico de ganancias
        </h3>
        <div className="mt-3 space-y-2">
          {(["weekly", "monthly", "yearly"] as const).map((period) => {
            const field = profitHistory[period];
            const label =
              period === "weekly"
                ? "Semana"
                : period === "monthly"
                  ? "Mes"
                  : "Año";
            return (
              <div
                key={period}
                className="flex items-center justify-between rounded-lg border border-dashed border-slate-200 px-4 py-3"
              >
                <p className="text-sm font-medium text-slate-700">{label}</p>
                <p className="text-xs text-slate-400">{field.label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
