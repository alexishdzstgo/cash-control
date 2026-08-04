"use client";

import { ChevronDown, Landmark, Wallet } from "lucide-react";
import { FinancialPopover } from "./FinancialPopover";
import { formatCurrency } from "@/lib/formatters";
import type { AttentionReason } from "@/lib/finance";

export type FinancialAlert = {
  id: string;
  title: string;
  detail: string;
  severity: "critical" | "warning";
  icon: "balance" | "movement";
};

export function FinancialAlertsPopover({
  alerts,
  compact = false,
}: {
  alerts: FinancialAlert[];
  compact?: boolean;
}) {
  const hasAlerts = alerts.length > 0;
  const hasCritical = alerts.some((alert) => alert.severity === "critical");
  const totalAlerts = alerts.length;

  const dotClass = hasCritical ? "bg-red-500" : "bg-amber-500";
  const textClass = hasCritical ? "text-red-700" : "text-amber-700";

  const button = (
    <span className="flex items-center gap-1.5">
      {hasAlerts ? (
        <>
          <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} aria-hidden="true" />
          <span className={`whitespace-nowrap text-xs font-medium ${textClass}`}>
            {compact
              ? `${totalAlerts}`
              : totalAlerts === 1
                ? "1 alerta"
                : `${totalAlerts} alertas`}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
        </>
      ) : (
        <>
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
          <span className="whitespace-nowrap text-xs font-medium text-emerald-700">
            {compact ? "" : "Todo bajo control"}
          </span>
        </>
      )}
    </span>
  );

  return (
    <FinancialPopover
      button={button}
      title="Alertas importantes"
      buttonClassName="flex shrink-0 items-center gap-1.5 rounded-lg px-1.5 py-1 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#93C5FD]"
      align="start"
    >
      {hasAlerts ? (
        <div className="space-y-1">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-start gap-2 rounded-lg px-3 py-2.5 ${
                alert.severity === "critical" ? "bg-red-50" : "bg-amber-50"
              }`}
            >
              {alert.icon === "balance" ? (
                <Wallet
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    alert.severity === "critical" ? "text-red-500" : "text-amber-600"
                  }`}
                  aria-hidden="true"
                />
              ) : (
                <Landmark
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    alert.severity === "critical" ? "text-red-500" : "text-amber-600"
                  }`}
                  aria-hidden="true"
                />
              )}
              <div>
                <p className="text-xs font-semibold text-slate-900">{alert.title}</p>
                <p className="text-[11px] text-slate-600">{alert.detail}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="px-3 py-2 text-sm text-slate-500">No hay alertas activas.</p>
      )}
    </FinancialPopover>
  );
}

export function attentionReasonToDetail(
  reason: AttentionReason,
  bank: { bankName: string; available: number; remainingMovements?: number },
): { detail: string; severity: "critical" | "warning"; icon: "balance" | "movement" } {
  switch (reason) {
    case "critical_balance":
      return {
        detail: `Saldo crítico: ${formatCurrency(bank.available)}`,
        severity: "critical",
        icon: "balance",
      };
    case "low_balance":
      return {
        detail: `Saldo disponible bajo: ${formatCurrency(bank.available)}`,
        severity: "warning",
        icon: "balance",
      };
    case "movement_limit_reached":
      return {
        detail: "Límite de movimientos visibles alcanzado",
        severity: "critical",
        icon: "movement",
      };
    case "movement_limit_warning":
      return {
        detail:
          bank.remainingMovements !== undefined
            ? `${bank.remainingMovements} movimientos visibles restantes`
            : "Cerca del límite de movimientos",
        severity: "warning",
        icon: "movement",
      };
  }
}