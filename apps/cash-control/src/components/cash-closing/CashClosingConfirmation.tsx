"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { CashClosingStatus } from "@/types/cash-closing";

type CashClosingConfirmationProps = {
  status: CashClosingStatus;
  countedCash: string;
  expectedCash: number;
  difference: number;
  onConfirm: () => void;
};

type ConfirmDialogState = "idle" | "confirming";

export function CashClosingConfirmation({
  status,
  countedCash,
  expectedCash,
  difference,
  onConfirm,
}: CashClosingConfirmationProps) {
  const [dialogState, setDialogState] = useState<ConfirmDialogState>("idle");
  const [observations, setObservations] = useState("");

  const differenceCents = Math.round(difference * 100);
  const hasDifference = differenceCents !== 0;
  const isInProgress = status === "in_progress";
  const hasCountedValue = countedCash !== "" && !Number.isNaN(Number(countedCash));

  const isObservationsRequired = hasDifference;
  const isObservationsValid =
    !isObservationsRequired || observations.trim().length >= 10;

  const canConfirm =
    isInProgress &&
    hasCountedValue &&
    isObservationsValid;

  const handleStartConfirm = () => {
    if (!canConfirm) return;
    setDialogState("confirming");
  };

  const handleConfirm = () => {
    onConfirm();
    setDialogState("idle");
    setObservations("");
  };

  const handleCloseDialog = () => {
    setDialogState("idle");
  };

  const differenceLabel =
    difference < 0
      ? `Faltante de ${formatCurrency(Math.abs(difference))}`
      : difference > 0
        ? `Sobrante de ${formatCurrency(difference)}`
        : "";

  const dialogTitle =
    differenceCents === 0
      ? "¿Confirmar corte de caja?"
      : differenceCents < 0
        ? "¿Confirmar corte con faltante?"
        : "¿Confirmar corte con sobrante?";

  const dialogDescription =
    differenceCents === 0
      ? "El efectivo contado coincide con el esperado por el sistema. No se detectaron diferencias en el corte."
      : differenceCents < 0
        ? `Se detectó un faltante de ${formatCurrency(Math.abs(difference))}. Este corte quedará marcado para revisión administrativa.`
        : `Se detectó un sobrante de ${formatCurrency(difference)}. Este corte quedará marcado para revisión administrativa.`;

  const dialogIconClassName =
    differenceCents === 0
      ? "text-emerald-500"
      : differenceCents < 0
        ? "text-red-500"
        : "text-amber-500";

  const DialogIcon =
    differenceCents === 0 ? CheckCircle2 : AlertTriangle;

  const dialogContentClassName =
    differenceCents === 0
      ? "bg-emerald-50"
      : differenceCents < 0
        ? "bg-red-50"
        : "bg-amber-50";

  const dialogTextClassName =
    differenceCents === 0
      ? "text-emerald-700"
      : differenceCents < 0
        ? "text-red-700"
        : "text-amber-700";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-400">
        Confirmación del corte
      </h3>

      <label className="block text-sm font-medium text-slate-700">
        Observaciones del corte
      </label>

      <textarea
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

      <div className="mt-4">
        <button
          type="button"
          onClick={handleStartConfirm}
          disabled={!canConfirm}
          className={`w-full rounded-xl px-4 py-2.5 text-sm font-medium transition ${
            canConfirm
              ? "bg-slate-900 text-white hover:bg-slate-800"
              : "cursor-not-allowed bg-slate-200 text-slate-500"
          }`}
        >
          Confirmar corte
        </button>
      </div>

      {dialogState === "confirming" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3 sm:p-6"
          onClick={handleCloseDialog}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-xl animate-in fade-in zoom-in-95 duration-200"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-lg font-bold text-slate-900">
                {dialogTitle}
              </h2>
            </div>

            <div className="p-5">
              <div className={`flex items-start gap-3 rounded-lg p-4 ${dialogContentClassName}`}>
                <DialogIcon className={`mt-0.5 h-5 w-5 shrink-0 ${dialogIconClassName}`} />
                <div>
                  <p className={`text-sm font-medium ${dialogTextClassName}`}>
                    {dialogDescription}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <span>Esperado</span>
                  <span className="font-medium text-slate-900">
                    {formatCurrency(expectedCash)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Contado</span>
                  <span className="font-medium text-slate-900">
                    {formatCurrency(Number(countedCash))}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Diferencia</span>
                  <span className="font-medium text-slate-900">
                    {formatCurrency(difference)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleCloseDialog}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 w-full sm:w-auto"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 w-full sm:w-auto"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}