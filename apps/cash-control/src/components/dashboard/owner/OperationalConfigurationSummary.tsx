"use client";

import { Settings2, AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/formatters";
import { computeFinancialTotals, computeBankMovementAlerts } from "@/lib/finance";
import { cashBalance, bankAccounts } from "@/components/balances/balanceMockData";
import { commissionSettings } from "./ownerDashboardMockData";

export function OperationalConfigurationSummary() {
  const totals = computeFinancialTotals();
  const bankAlerts = computeBankMovementAlerts();

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            Configuración operativa
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Valores que controlan alertas y movimientos
          </p>
        </div>
        <Link
          href="/balances"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2563EB] transition-colors hover:text-[#1D4ED8]"
        >
          Ver
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Comisiones */}
        <div>
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-slate-900">Comisiones</h3>
          </div>
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
              <p className="text-sm font-medium text-amber-800">
                {commissionSettings.status === "pending_configuration"
                  ? "Comisiones sin configurar"
                  : "Comisiones configuradas"}
              </p>
            </div>
            <p className="mt-1 text-xs text-amber-700">{commissionSettings.note}</p>
            <Link
              href="#"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 hover:text-amber-900"
            >
              Configurar comisiones
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {/* Alertas de saldo por recurso */}
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Alertas de saldo</h3>
          <div className="mt-2 space-y-2">
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-3">
              <p className="text-sm font-medium text-slate-700">Caja física</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Advertencia: {formatCurrency(cashBalance.lowBalanceThreshold ?? 0)} · Crítico:{" "}
                {formatCurrency(cashBalance.criticalBalanceThreshold ?? 0)}
              </p>
            </div>
            {bankAccounts.map((bank) => (
              <div
                key={bank.id}
                className="rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-3"
              >
                <p className="text-sm font-medium text-slate-700">{bank.bankName}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Advertencia: {formatCurrency(bank.lowBalanceThreshold ?? 0)} · Crítico:{" "}
                  {formatCurrency(bank.criticalBalanceThreshold ?? 0)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Movimientos visibles */}
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Movimientos visibles
          </h3>
          <div className="mt-2 space-y-2">
            {bankAlerts.length > 0 ? (
              bankAlerts.map((alert) => (
                <div
                  key={alert.bankId}
                  className="rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-3"
                >
                  <p className="text-sm font-medium text-slate-700">
                    {alert.bankName}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Límite visible:{" "}
                    {bankAccounts.find((bank) => bank.id === alert.bankId)
                      ?.visibleMovementLimit ?? "—"}{" "}
                    {alert.remainingVisibleMovements > 0 && (
                      <> · {alert.remainingVisibleMovements} restantes</>
                    )}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500">
                Sin límites de movimientos configurados.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}