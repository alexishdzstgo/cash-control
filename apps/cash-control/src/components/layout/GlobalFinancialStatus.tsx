"use client";

import { Landmark } from "lucide-react";
import { useBusinessFunds } from "@/components/business-funds/BusinessFundsContext";
import { useFinancialAlerts } from "@/components/bank-alerts/FinancialAlertsContext";
import { computeFinancialTotalsFromBalances } from "@/lib/finance";
import { formatCurrency } from "@/lib/formatters";
import {
  type FinancialAlert,
  FinancialAlertsPopover,
} from "./FinancialAlertsPopover";
import { FinancialPopover } from "./FinancialPopover";
import { FinancialStatusItem } from "./FinancialStatusItem";
import { FinancialSummaryPopover } from "./FinancialSummaryPopover";

export function GlobalFinancialStatus() {
  const { cash, banks } = useBusinessFunds();
  const totals = computeFinancialTotalsFromBalances({ cash, banks });
  const { overview } = useFinancialAlerts();
  const cashResource = overview.resources.find((resource) => resource.id === "cash");
  const alerts: FinancialAlert[] = overview.alerts.map((alert) => ({
    id: `${alert.resourceId}-${alert.type}`,
    title: alert.resourceName,
    detail: getFinancialAlertDetail(alert),
    severity: alert.severity,
    icon:
      alert.type === "movement_limit_reached" ||
      alert.type === "movement_limit_warning"
        ? "movement"
        : "balance",
  }));

  // Sort: critical first, then warning
  const sortedAlerts = [...alerts].sort((a, b) => {
    if (a.severity === b.severity) return 0;
    return a.severity === "critical" ? -1 : 1;
  });

  const bankItems = overview.resources.filter(
    (resource) => resource.type === "bank",
  );

  return (
    <div className="flex min-w-0 items-center gap-2">
      {/* ── Desktop wide: full financial bar ── */}
      <div className="hidden min-w-0 items-center gap-4 xl:flex">
        <FinancialStatusItem
          label="Disponible total"
          value={totals.totalAvailable}
          emphasized
        />
        <Divider />
        <FinancialStatusItem
          label="Caja"
          value={totals.cashAvailable}
          status={cashResource?.status ?? totals.cashBalanceStatus}
        />
        <Divider />
        {bankItems.map((bank) => (
          <FinancialStatusItem
            key={bank.id}
            label={bank.name}
            value={bank.available}
            status={bank.status}
          />
        ))}
        <Divider />
        <FinancialAlertsPopover alerts={sortedAlerts} />
      </div>

      {/* ── Medium: compact with banks popover ── */}
      <div className="hidden min-w-0 items-center gap-3 md:flex xl:hidden">
        <FinancialStatusItem
          label="Disponible total"
          value={totals.totalAvailable}
          emphasized
        />
        <Divider />
        <FinancialStatusItem
          label="Caja"
          value={totals.cashAvailable}
          status={cashResource?.status ?? totals.cashBalanceStatus}
        />
        <Divider />
        <BanksPopover bankItems={bankItems} />
        <Divider />
        <FinancialAlertsPopover alerts={sortedAlerts} />
      </div>

      {/* ── Small: summary + popover ── */}
      <div className="flex min-w-0 items-center gap-2 md:hidden">
        <FinancialStatusItem
          label="Disponible total"
          value={totals.totalAvailable}
          emphasized
        />
        <FinancialSummaryPopover
          totals={totals}
          bankItems={bankItems}
          alerts={sortedAlerts}
        />
        <FinancialAlertsPopover alerts={sortedAlerts} compact />
      </div>
    </div>
  );
}

function BanksPopover({
  bankItems,
}: {
  bankItems: Array<{
    id: string;
    name: string;
    available: number;
    reserved: number;
    status: "normal" | "warning" | "critical";
  }>;
}) {
  const button = (
    <span className="flex items-center gap-1.5">
      <Landmark className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
      Bancos
    </span>
  );

  return (
    <FinancialPopover
      button={button}
      title="Disponible por banco"
      buttonClassName="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
      align="start"
    >
      <div className="space-y-1">
        {bankItems.map((bank) => {
          const style = STATUS_STYLES[bank.status];
          const labelText = STATUS_LABELS[bank.status];
          return (
            <div
              key={bank.id}
              className={`flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-slate-50 ${style.bgClass ?? ""}`}
            >
              <div>
                <div className="flex items-center gap-1.5">
                  {bank.status !== "normal" && (
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${style.dotClass}`}
                      aria-hidden="true"
                    />
                  )}
                  <p className="text-xs font-semibold text-slate-900">
                    {bank.name}
                  </p>
                  {labelText && (
                    <span
                      className={`text-[10px] font-medium ${style.labelClass}`}
                    >
                      {labelText}
                    </span>
                  )}
                </div>
                {bank.reserved > 0 && (
                  <p className="text-[11px] text-slate-500">
                    {formatCurrency(bank.reserved)} reservado
                  </p>
                )}
              </div>
              <p
                className={`text-sm font-semibold tabular-nums ${style.valueClass}`}
              >
                {formatCurrency(bank.available)}
              </p>
            </div>
          );
        })}
      </div>
    </FinancialPopover>
  );
}

const STATUS_STYLES: Record<
  string,
  { labelClass: string; valueClass: string; dotClass: string; bgClass?: string }
> = {
  normal: {
    labelClass: "text-slate-500",
    valueClass: "text-slate-800",
    dotClass: "bg-slate-300",
  },
  warning: {
    labelClass: "text-amber-700",
    valueClass: "text-amber-800",
    dotClass: "bg-amber-500",
    bgClass: "bg-amber-50/70",
  },
  critical: {
    labelClass: "text-red-700",
    valueClass: "text-red-800",
    dotClass: "bg-red-500",
    bgClass: "bg-red-50/70",
  },
};

const STATUS_LABELS: Record<string, string> = {
  normal: "",
  warning: "Atención",
  critical: "Crítico",
};

function Divider() {
  return <span className="h-6 w-px shrink-0 bg-slate-200" aria-hidden="true" />;
}

function getFinancialAlertDetail(
  alert: import("@/lib/financialAlerts").FinancialAlert,
): string {
  if (alert.type === "critical_balance") {
    return `Saldo crítico: ${formatCurrency(alert.available)}`;
  }
  if (alert.type === "low_balance") {
    return `Saldo disponible bajo: ${formatCurrency(alert.available)}`;
  }
  if (alert.type === "movement_limit_reached") {
    return "Límite de movimientos visibles alcanzado";
  }
  return alert.remainingVisibleMovements !== undefined
    ? `${alert.remainingVisibleMovements} movimientos visibles restantes`
    : "Cerca del límite de movimientos";
}
