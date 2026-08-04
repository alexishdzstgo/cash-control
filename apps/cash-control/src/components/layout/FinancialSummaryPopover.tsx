"use client";

import { ChevronDown, Wallet } from "lucide-react";
import { FinancialPopover } from "./FinancialPopover";
import { formatCurrency } from "@/lib/formatters";
import type { BankBreakdownItem, FinancialTotals } from "@/lib/finance";
import type { FinancialAlert } from "./FinancialAlertsPopover";

const STATUS_LABELS: Record<string, string> = {
  normal: "",
  warning: "Atención",
  critical: "Crítico",
};

export function FinancialSummaryPopover({
  totals,
  bankItems,
  alerts,
}: {
  totals: FinancialTotals;
  bankItems: BankBreakdownItem[];
  alerts: FinancialAlert[];
}) {
  const cashLabel = STATUS_LABELS[totals.cashBalanceStatus];

  const button = (
    <span className="flex items-center gap-1.5">
      <Wallet className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
      Resumen
      <ChevronDown className="h-3 w-3 text-slate-400" aria-hidden="true" />
    </span>
  );

  return (
    <FinancialPopover
      button={button}
      title="Resumen financiero"
      buttonClassName="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
      align="start"
    >
      <div className="space-y-1">
        <SummaryRow label="Disponible total" value={totals.totalAvailable} emphasized />
        <SummaryRow label="Caja" value={totals.cashAvailable} secondary={cashLabel || undefined} />
        {bankItems.map((bank) => {
          const labelText = STATUS_LABELS[bank.resourceStatus];
          return (
            <SummaryRow
              key={bank.bankId}
              label={bank.bankName}
              value={bank.available}
              secondary={[
                labelText || "",
                bank.reserved > 0 ? `${formatCurrency(bank.reserved)} reservado` : "",
              ]
                .filter(Boolean)
                .join(" · ")
                .trim() || undefined}
            />
          );
        })}
      </div>
      {alerts.length > 0 && (
        <div className="mt-2 border-t border-slate-100 pt-2">
          <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Alertas
          </p>
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-start gap-2 rounded-lg px-3 py-2 ${
                alert.severity === "critical" ? "bg-red-50" : "bg-amber-50"
              }`}
            >
              <div>
                <p className="text-xs font-semibold text-slate-900">{alert.title}</p>
                <p className="text-[11px] text-slate-600">{alert.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </FinancialPopover>
  );
}

function SummaryRow({
  label,
  value,
  emphasized = false,
  secondary,
}: {
  label: string;
  value: number;
  emphasized?: boolean;
  secondary?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-slate-50">
      <div>
        <p className={`text-xs ${emphasized ? "font-bold text-slate-950" : "font-semibold text-slate-900"}`}>
          {label}
        </p>
        {secondary && <p className="text-[11px] text-slate-500">{secondary}</p>}
      </div>
      <p className={`text-sm tabular-nums ${emphasized ? "font-bold text-slate-950" : "font-semibold text-slate-900"}`}>
        {formatCurrency(value)}
      </p>
    </div>
  );
}