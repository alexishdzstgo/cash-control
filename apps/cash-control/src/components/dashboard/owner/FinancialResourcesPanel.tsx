"use client";

import { ArrowRight, Landmark, Wallet } from "lucide-react";
import Link from "next/link";
import { useBusinessFunds } from "@/components/business-funds/BusinessFundsContext";
import {
  computeBankMovementAlertsFromBanks,
  computeFinancialTotalsFromBalances,
  type FinancialResourceStatus,
} from "@/lib/finance";
import { formatCurrency } from "@/lib/formatters";

const statusConfig: Record<
  FinancialResourceStatus,
  { label: string; textClass: string; dotClass: string }
> = {
  normal: {
    label: "Normal",
    textClass: "text-slate-600",
    dotClass: "bg-slate-300",
  },
  warning: {
    label: "Atención",
    textClass: "text-amber-700",
    dotClass: "bg-amber-500",
  },
  critical: {
    label: "Crítico",
    textClass: "text-red-700",
    dotClass: "bg-red-500",
  },
};

export function FinancialResourcesPanel() {
  const { cash, banks } = useBusinessFunds();
  const totals = computeFinancialTotalsFromBalances({ cash, banks });
  const bankAlerts = computeBankMovementAlertsFromBanks(banks);

  const cashStatus: FinancialResourceStatus = totals.cashIsCritical
    ? "critical"
    : totals.cashIsLow
      ? "warning"
      : "normal";

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            Caja y bancos
          </h2>
          <p className="mt-1 text-sm text-slate-500">¿Dónde está tu dinero?</p>
        </div>
        <Link
          href="/balances"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2563EB] transition-colors hover:text-[#1D4ED8]"
        >
          Ver detalle
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="divide-y divide-slate-100">
        {/* Caja física */}
        <ResourceRow
          icon={<Wallet className="h-4 w-4" aria-hidden="true" />}
          title="Caja física"
          available={totals.cashAvailable}
          reserved={totals.cashReserved}
          status={cashStatus}
          subtitle="Disponible y reservado para retiros"
        />

        {totals.bankBreakdown.map((bank) => {
          const alert = bankAlerts.find((a) => a.bankId === bank.bankId);
          return (
            <ResourceRow
              key={bank.bankId}
              icon={<Landmark className="h-4 w-4" aria-hidden="true" />}
              title={bank.bankName}
              available={bank.available}
              reserved={bank.reserved}
              status={bank.resourceStatus}
              subtitle={
                alert && (alert.isAtLimit || alert.isNearLimit)
                  ? `${alert.remainingVisibleMovements} movimientos visibles restantes`
                  : "Saldo combinado"
              }
            />
          );
        })}
      </div>
    </section>
  );
}

function ResourceRow({
  icon,
  title,
  available,
  reserved,
  status,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  available: number;
  reserved: number;
  status: FinancialResourceStatus;
  subtitle?: string;
}) {
  const config = statusConfig[status];

  return (
    <div className="px-6 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-slate-900">{title}</p>
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-medium ${config.textClass}`}
              >
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${config.dotClass}`}
                  aria-hidden="true"
                />
                {config.label}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-base font-semibold text-slate-900 tabular-nums">
            {formatCurrency(available)}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            {formatCurrency(reserved)} reservado
          </p>
        </div>
      </div>
    </div>
  );
}
