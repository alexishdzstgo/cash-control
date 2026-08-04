"use client";

import { formatCurrency } from "@/lib/formatters";
import type { FinancialResourceStatus } from "@/lib/finance";

type HealthStyle = {
  labelClass: string;
  valueClass: string;
  dotClass: string;
  bgClass?: string;
};

const HEALTH_STYLES: Record<FinancialResourceStatus, HealthStyle> = {
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

const STATUS_LABELS: Record<FinancialResourceStatus, string> = {
  normal: "",
  warning: "Atención",
  critical: "Crítico",
};

export function FinancialStatusItem({
  label,
  value,
  emphasized = false,
  status = "normal",
}: {
  label: string;
  value: number;
  emphasized?: boolean;
  status?: FinancialResourceStatus;
}) {
  const style = HEALTH_STYLES[status];
  const statusLabel = STATUS_LABELS[status];

  return (
    <div className={`min-w-0 shrink-0 rounded-md px-1.5 py-1 ${style.bgClass ?? ""}`}>
      <div className="flex items-center gap-1.5">
        {status !== "normal" && (
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${style.dotClass}`}
            aria-hidden="true"
          />
        )}
        <p className={`truncate text-[10px] font-medium uppercase tracking-wide ${style.labelClass}`}>
          {label}
          {statusLabel ? ` · ${statusLabel}` : ""}
        </p>
      </div>
      <p
        className={`truncate tabular-nums ${
          emphasized
            ? "text-sm font-bold text-slate-950"
            : `text-sm font-semibold ${style.valueClass}`
        }`}
      >
        {formatCurrency(value)}
      </p>
    </div>
  );
}