"use client";

import { AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { CashClosingStatus } from "@/types/cash-closing";

type CashClosingResultProps = {
  status: CashClosingStatus;
  countedCash: string;
  expectedCash: number;
  difference: number;
  shiftName: string;
  responsibleName: string;
  observations: string;
  onReset: () => void;
};

export function CashClosingResult({
  status,
  countedCash,
  expectedCash,
  difference,
  shiftName,
  responsibleName,
  observations,
  onReset,
}: CashClosingResultProps) {
  const countedNumeric = Number(countedCash);
  const resultStatus: "balanced" | "shortage" | "surplus" =
    status === "review_required"
      ? difference < 0
        ? "shortage"
        : "surplus"
      : status === "balanced" || status === "shortage" || status === "surplus"
        ? status
        : "balanced";

  const config = {
    balanced: {
      title: "Caja correcta",
      subtitle: "Corte realizado",
      description:
        "El efectivo contado coincide con los movimientos registrados.",
      icon: CheckCircle2,
      iconClassName: "text-emerald-500",
      badgeClassName: "bg-emerald-50 text-emerald-700",
      valueClassName: "text-emerald-700",
    },
    shortage: {
      title: "Falta efectivo",
      subtitle: "Corte realizado con faltante",
      description:
        "Hay menos efectivo del que debería existir según los movimientos registrados.",
      icon: AlertTriangle,
      iconClassName: "text-red-500",
      badgeClassName: "bg-red-50 text-red-700",
      valueClassName: "text-red-700",
    },
    surplus: {
      title: "Sobra efectivo",
      subtitle: "Corte realizado con sobrante",
      description:
        "Hay más efectivo del que debería existir según los movimientos registrados.",
      icon: TrendingUp,
      iconClassName: "text-blue-500",
      badgeClassName: "bg-blue-50 text-blue-700",
      valueClassName: "text-blue-700",
    },
  };

  const current = config[resultStatus];
  const Icon = current.icon;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start gap-4">
          <Icon className={`mt-1 h-8 w-8 shrink-0 ${current.iconClassName}`} />
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {current.title}
            </h2>
            <p
              className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${current.badgeClassName}`}
            >
              {current.subtitle}
            </p>
            <p className="mt-3 text-sm text-slate-600">{current.description}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-400">
          Resumen del corte
        </h3>

        <div className="space-y-3">
          <ResultRow label="Esperado" value={formatCurrency(expectedCash)} />
          <ResultRow label="Contado" value={formatCurrency(countedNumeric)} />
          <ResultRow
            label="Diferencia"
            value={
              difference > 0
                ? `+${formatCurrency(difference)}`
                : formatCurrency(difference)
            }
            className={current.valueClassName}
          />

          <div className="border-t border-slate-100 pt-3">
            <ResultRow label="Responsable" value={responsibleName} />
            <ResultRow label="Corte" value={shiftName} />
          </div>

          {observations.trim() !== "" && (
            <div className="border-t border-slate-100 pt-3">
              <p className="text-sm font-medium text-slate-700">
                Observaciones
              </p>
              <p className="mt-1 text-sm text-slate-600">{observations}</p>
            </div>
          )}
        </div>
      </div>

      <button type="button" onClick={onReset} className="btn-secondary w-full">
        Reiniciar demostración
      </button>
    </div>
  );
}

function ResultRow({
  label,
  value,
  className = "text-slate-900",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-600">{label}</span>
      <span className={`font-medium tabular-nums ${className}`}>{value}</span>
    </div>
  );
}
