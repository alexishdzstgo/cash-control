"use client";

import { CheckCircle2, AlertTriangle, TrendingUp } from "lucide-react";
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
      title: "Caja cuadrada",
      subtitle: "Corte realizado",
      description:
        "El efectivo contado coincide con el esperado por el sistema.",
      icon: CheckCircle2,
      iconClassName: "text-emerald-500",
      badgeClassName: "bg-emerald-50 text-emerald-700",
    },
    shortage: {
      title: "Faltante",
      subtitle: "Corte realizado",
      description: `El corte quedó marcado para revisión.`,
      icon: AlertTriangle,
      iconClassName: "text-red-500",
      badgeClassName: "bg-red-50 text-red-700",
    },
    surplus: {
      title: "Sobrante",
      subtitle: "Corte realizado",
      description: `El corte quedó marcado para revisión.`,
      icon: TrendingUp,
      iconClassName: "text-amber-500",
      badgeClassName: "bg-amber-50 text-amber-700",
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
            <h2 className="text-2xl font-bold text-slate-900">{current.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{current.subtitle}</p>
            <p className="mt-2 text-sm text-slate-600">{current.description}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-400">
          Resumen del corte
        </h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Esperado</span>
            <span className="font-medium text-slate-900">
              {formatCurrency(expectedCash)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Contado</span>
            <span className="font-medium text-slate-900">
              {formatCurrency(countedNumeric)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Diferencia</span>
            <span className={`font-semibold ${resultStatus === "balanced" ? "text-emerald-700" : resultStatus === "shortage" ? "text-red-700" : "text-amber-700"}`}>
              {formatCurrency(difference)}
            </span>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Responsable</span>
              <span className="font-medium text-slate-900">{responsibleName}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-slate-600">Turno</span>
              <span className="font-medium text-slate-900">{shiftName}</span>
            </div>
          </div>

          {observations.trim() !== "" && (
            <div className="border-t border-slate-100 pt-3">
              <p className="text-sm font-medium text-slate-700">Observaciones</p>
              <p className="mt-1 text-sm text-slate-600">{observations}</p>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
      >
        Reiniciar demostración
      </button>
    </div>
  );
}