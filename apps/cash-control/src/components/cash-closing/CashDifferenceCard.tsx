"use client";

import { AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

type CashDifferenceCardProps = {
  countedCash: string;
  expectedCash: number;
};

type ClosingResult = "pending" | "balanced" | "shortage" | "surplus";

function getClosingResult(
  countedCash: string,
  expectedCash: number,
): ClosingResult {
  if (countedCash === "" || countedCash.trim() === "") {
    return "pending";
  }

  const counted = Number(countedCash);

  if (Number.isNaN(counted)) {
    return "pending";
  }

  const differenceCents =
    Math.round(counted * 100) - Math.round(expectedCash * 100);

  if (differenceCents === 0) return "balanced";
  if (differenceCents < 0) return "shortage";
  return "surplus";
}

export function CashDifferenceCard({
  countedCash,
  expectedCash,
}: CashDifferenceCardProps) {
  const result = getClosingResult(countedCash, expectedCash);

  const countedNumeric = countedCash === "" ? NaN : Number(countedCash);
  const hasCountedValue = countedCash !== "" && !Number.isNaN(countedNumeric);
  const difference = hasCountedValue ? countedNumeric - expectedCash : NaN;
  const differenceCents = hasCountedValue ? Math.round(difference * 100) : NaN;

  const config = {
    pending: {
      title: "Diferencia de caja",
      value: "Pendiente de conteo",
      description: "Captura el efectivo contado para calcular la diferencia.",
      icon: TrendingUp,
      iconClassName: "text-slate-400",
      badgeClassName: "bg-slate-100 text-slate-600",
      valueClassName: "text-slate-500",
    },
    balanced: {
      title: "Caja correcta",
      value: formatCurrency(0),
      description:
        "El efectivo contado coincide con los movimientos registrados.",
      icon: CheckCircle2,
      iconClassName: "text-emerald-500",
      badgeClassName: "bg-emerald-50 text-emerald-700",
      valueClassName: "text-emerald-700",
    },
    shortage: {
      title: "Falta efectivo",
      value: formatCurrency(difference),
      description:
        "Hay menos efectivo del que debería existir según los movimientos registrados.",
      icon: AlertTriangle,
      iconClassName: "text-red-500",
      badgeClassName: "bg-red-50 text-red-700",
      valueClassName: "text-red-700",
    },
    surplus: {
      title: "Sobra efectivo",
      value: `+${formatCurrency(difference)}`,
      description:
        "Hay más efectivo del que debería existir según los movimientos registrados.",
      icon: TrendingUp,
      iconClassName: "text-blue-500",
      badgeClassName: "bg-blue-50 text-blue-700",
      valueClassName: "text-blue-700",
    },
  };

  const current = config[result];
  const Icon = current.icon;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{current.title}</p>
          <p className={`mt-1 text-2xl font-bold ${current.valueClassName}`}>
            {current.value}
          </p>
          <p
            className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${current.badgeClassName}`}
          >
            {current.description}
          </p>
        </div>
        <Icon className={`mt-1 h-6 w-6 shrink-0 ${current.iconClassName}`} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 text-center sm:grid-cols-3">
        <Metric label="Esperado" value={formatCurrency(expectedCash)} />
        <Metric
          label="Contado"
          value={hasCountedValue ? formatCurrency(countedNumeric) : "—"}
        />
        <Metric
          label="Diferencia"
          value={
            hasCountedValue
              ? differenceCents > 0
                ? `+${formatCurrency(difference)}`
                : formatCurrency(difference)
              : "—"
          }
          className={current.valueClassName}
        />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  className = "text-slate-900",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-semibold tabular-nums ${className}`}>
        {value}
      </p>
    </div>
  );
}
