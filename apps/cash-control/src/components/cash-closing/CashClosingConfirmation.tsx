"use client";

import { AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";
import { useId, useState } from "react";
import { formatCurrency } from "@/lib/formatters";
import type {
  CashClosingStatus,
  ShiftCommissionProfitSummary,
} from "@/types/cash-closing";

type CashClosingConfirmationProps = {
  status: CashClosingStatus;
  countedCash: string;
  expectedCash: number;
  openingBalance: number;
  totalEntries: number;
  totalOutputs: number;
  reservedCash: number;
  availableCash: number;
  commissionProfit: ShiftCommissionProfitSummary;
  difference: number;
  onBack: () => void;
  onConfirm: (observations: string) => void;
};

type ConfirmDialogState = "idle" | "confirming";

export function CashClosingConfirmation({
  status,
  countedCash,
  expectedCash,
  openingBalance,
  totalEntries,
  totalOutputs,
  reservedCash,
  availableCash,
  commissionProfit,
  difference,
  onBack,
  onConfirm,
}: CashClosingConfirmationProps) {
  const observationsId = useId();
  const [dialogState, setDialogState] = useState<ConfirmDialogState>("idle");
  const [observations, setObservations] = useState("");

  const differenceCents = Math.round(difference * 100);
  const hasDifference = differenceCents !== 0;
  const isInProgress = status === "in_progress";
  const hasCountedValue =
    countedCash !== "" && !Number.isNaN(Number(countedCash));
  const isObservationsRequired = hasDifference;
  const isObservationsValid =
    !isObservationsRequired || observations.trim().length >= 10;
  const canConfirm = isInProgress && hasCountedValue && isObservationsValid;
  const result = getResultConfig(differenceCents);
  const DialogIcon = result.icon;

  function handleStartConfirm() {
    if (!canConfirm) return;
    setDialogState("confirming");
  }

  function handleConfirm() {
    onConfirm(observations.trim());
    setDialogState("idle");
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-400">
        Cierre final
      </h3>

      <label
        htmlFor={observationsId}
        className="block text-sm font-medium text-slate-700"
      >
        Observaciones del corte
      </label>

      <textarea
        id={observationsId}
        value={observations}
        onChange={(event) => setObservations(event.target.value)}
        disabled={!isInProgress}
        placeholder={
          hasDifference
            ? "Explica brevemente el motivo del faltante o sobrante."
            : "Observaciones opcionales del corte."
        }
        rows={4}
        className={`mt-1 w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition ${
          isObservationsRequired && observations.trim().length < 10
            ? "border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500"
            : "border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
        } ${!isInProgress ? "cursor-not-allowed bg-slate-50 text-slate-500" : ""}`}
      />

      {isObservationsRequired && observations.trim().length < 10 && (
        <p className="mt-1 text-xs text-red-600">
          Explica brevemente el motivo del faltante o sobrante.
        </p>
      )}

      {!isObservationsRequired && (
        <p className="mt-1 text-xs text-slate-500">
          La observación es opcional cuando el corte está cuadrado.
        </p>
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onBack} className="btn-secondary">
          Volver y revisar
        </button>
        <button
          type="button"
          onClick={handleStartConfirm}
          disabled={!canConfirm}
          className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
            canConfirm
              ? "bg-slate-900 text-white hover:bg-slate-800"
              : "cursor-not-allowed bg-slate-200 text-slate-500"
          }`}
        >
          Confirmar cierre
        </button>
      </div>

      {dialogState === "confirming" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3 sm:p-6">
          <div
            className="flex max-h-[90dvh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl animate-in fade-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-lg font-bold text-slate-900">
                Confirmar cierre
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Revisa el resumen antes de cerrar el turno.
              </p>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
              <div
                className={`flex items-start gap-3 rounded-lg p-4 ${result.bg}`}
              >
                <DialogIcon
                  className={`mt-0.5 h-5 w-5 shrink-0 ${result.iconClass}`}
                />
                <div>
                  <p className={`text-sm font-semibold ${result.textClass}`}>
                    {result.title}
                  </p>
                  <p className={`mt-1 text-sm ${result.textClass}`}>
                    {result.description}
                  </p>
                </div>
              </div>

              <SummarySection
                title="Inicio"
                rows={[["Caja inicial", openingBalance]]}
              />
              <SummarySection
                title="Durante el turno"
                rows={[
                  ["Entradas", totalEntries, "+"],
                  ["Salidas", totalOutputs, "-"],
                ]}
              />
              <SummarySection
                title="Resultado del sistema"
                rows={[["Efectivo esperado", expectedCash]]}
              />
              <SummarySection
                title="Conteo"
                rows={[
                  ["Efectivo contado", Number(countedCash)],
                  ["Diferencia", difference, difference > 0 ? "+" : ""],
                ]}
              />
              <SummarySection
                title="Dinero apartado y disponible"
                rows={[
                  ["Retiros pendientes", reservedCash],
                  ["Para continuar trabajando", availableCash],
                ]}
              />
              <SummarySection
                title="Ganancia"
                rows={[
                  ["Comisiones", commissionProfit.totalCommissionProfit],
                  ["Caja física", commissionProfit.cashCommissionProfit],
                  ["Bancos", commissionProfit.bankCommissionProfit],
                ]}
              />
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDialogState("idle")}
                className="btn-secondary"
              >
                Volver y revisar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Cerrar turno
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummarySection({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, number, string?]>;
}) {
  return (
    <section className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-400">
        {title}
      </h3>
      <div className="mt-3 space-y-2">
        {rows.map(([label, value, sign]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="text-slate-600">{label}</span>
            <span className="font-semibold text-slate-950 tabular-nums">
              {sign}
              {formatCurrency(value)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function getResultConfig(differenceCents: number) {
  if (differenceCents === 0) {
    return {
      title: "Caja cuadrada",
      description:
        "El efectivo contado coincide con los movimientos registrados.",
      icon: CheckCircle2,
      bg: "bg-emerald-50",
      iconClass: "text-emerald-500",
      textClass: "text-emerald-700",
    };
  }

  if (differenceCents < 0) {
    return {
      title: "Falta efectivo",
      description:
        "Hay menos efectivo del que debería existir según los movimientos registrados.",
      icon: AlertTriangle,
      bg: "bg-red-50",
      iconClass: "text-red-500",
      textClass: "text-red-700",
    };
  }

  return {
    title: "Sobra efectivo",
    description:
      "Hay más efectivo del que debería existir según los movimientos registrados.",
    icon: TrendingUp,
    bg: "bg-blue-50",
    iconClass: "text-blue-500",
    textClass: "text-blue-700",
  };
}
