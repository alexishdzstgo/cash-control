"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  Settings2,
} from "lucide-react";
import Link from "next/link";
import { useBusinessFunds } from "@/components/business-funds/BusinessFundsContext";
import { useCommissionRules } from "@/components/commissions/CommissionRulesContext";
import { formatCurrency } from "@/lib/formatters";

export function OperationalConfigurationSummary() {
  const { cash, banks } = useBusinessFunds();
  const { rules: commissionRules, isLoading: isLoadingRules } = useCommissionRules();

  const activeRules = commissionRules.filter((r) => r.status === "active");

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
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-blue transition-colors hover:text-primary-blue-hover"
        >
          Ver recursos
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="px-6 py-5 space-y-6">
        {/* Comisiones (Conectado a Base de Datos real) */}
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-slate-900">Comisiones</h3>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Datos en BD
            </span>
          </div>

          <div className="mt-2.5">
            {isLoadingRules ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 text-xs text-slate-400">
                Cargando reglas de comisión desde la base de datos...
              </div>
            ) : activeRules.length > 0 ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      className="h-4 w-4 text-emerald-600"
                      aria-hidden="true"
                    />
                    <p className="text-sm font-medium text-emerald-900">
                      {activeRules.length} regla{activeRules.length === 1 ? "" : "s"} activa{activeRules.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Link
                    href="/commissions"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:text-emerald-950 transition-colors"
                  >
                    Gestionar
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>
                <p className="mt-1 text-xs text-emerald-700">
                  Reglas de comisiones sincronizadas y operando en vivo en el sistema.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle
                      className="h-4 w-4 text-amber-600"
                      aria-hidden="true"
                    />
                    <p className="text-sm font-medium text-amber-800">
                      Sin reglas activas
                    </p>
                  </div>
                  <Link
                    href="/commissions"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 hover:text-amber-950 transition-colors"
                  >
                    Crear reglas
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>
                <p className="mt-1 text-xs text-amber-700">
                  No hay reglas de comisiones activas registradas en la base de datos.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Alertas de saldo por recurso */}
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              Alertas de saldo
            </h3>
            <span className="text-[11px] text-slate-400">Umbrales operativos</span>
          </div>

          <div className="mt-2.5 space-y-2.5">
            {/* Caja física: Persistente en BD */}
            <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-900">Caja física</p>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  En BD
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Advertencia: <span className="font-semibold text-slate-700">{formatCurrency(cash.lowBalanceThreshold ?? 0)}</span> ·
                Crítico: <span className="font-semibold text-slate-700">{formatCurrency(cash.criticalBalanceThreshold ?? 0)}</span>
              </p>
            </div>

            {/* Bancos: Conectados pero umbrales pendientes en BD */}
            {banks.map((bank) => (
              <div
                key={bank.id}
                className="rounded-lg border border-slate-100 bg-slate-50/60 p-3.5"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700">
                    {bank.bankName}
                  </p>
                  <span className="text-[11px] font-medium text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded">
                    En espera de conectar
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Los umbrales de alerta para cuentas bancarias están pendientes de agregarse a la base de datos.
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Movimientos visibles */}
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Movimientos visibles por banco
          </h3>
          <div className="mt-2.5">
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-4">
              <div className="flex items-start gap-3">
                <Database className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="text-xs font-semibold text-slate-700">
                    Límites de movimientos mensuales: En espera de conectar a datos reales
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
                    Esta métrica requiere las columnas de límite visible mensual en la tabla bancaria de Supabase para rastrear las transferencias en tiempo real.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
