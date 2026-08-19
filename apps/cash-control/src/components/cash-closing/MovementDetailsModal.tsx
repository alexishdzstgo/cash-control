"use client";

import { X } from "lucide-react";
import { useEffect, useId } from "react";
import { CASH_CLOSING_CATEGORY_META } from "@/lib/cashClosing";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import type { CashMovement, CashMovementCategory } from "@/types/cash-closing";

type MovementDetailsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  category: CashMovementCategory;
  movements: CashMovement[];
};

export function MovementDetailsModal({
  isOpen,
  onClose,
  category,
  movements,
}: MovementDetailsModalProps) {
  const titleId = useId();
  const categoryTotal = movements.reduce(
    (sum, movement) => sum + movement.amount,
    0,
  );
  const categoryLabel = CASH_CLOSING_CATEGORY_META[category].label;

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3 sm:p-6">
      <div
        className="cc-modal-surface flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl shadow-xl animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="cc-modal-header flex shrink-0 items-center justify-between px-5 py-4">
          <div className="min-w-0 pr-4">
            <h2 id={titleId} className="cc-modal-title text-lg font-bold">
              {categoryLabel}
            </h2>
            <p className="cc-modal-description mt-1 text-sm">
              {CASH_CLOSING_CATEGORY_META[category].helperText}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5">
          <div className="hidden sm:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="pb-3 pr-4">Folio</th>
                  <th className="pb-3 pr-4">Descripción</th>
                  <th className="pb-3 pr-4 text-right">Monto</th>
                  <th className="pb-3 pr-4">Fecha y hora</th>
                  <th className="pb-3 pr-4">Usuario</th>
                  <th className="pb-3 pr-4">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr
                    key={movement.id}
                    className="border-b border-slate-50 last:border-none"
                  >
                    <td className="py-3 pr-4 font-medium whitespace-nowrap text-slate-900">
                      {movement.folio}
                    </td>
                    <td className="py-3 pr-4 text-slate-700">
                      {movement.description}
                    </td>
                    <td className="py-3 pr-4 text-right font-medium whitespace-nowrap text-slate-900">
                      {formatCurrency(movement.amount)}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap text-slate-500">
                      {formatMovementDate(movement.registeredAt)}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap text-slate-500">
                      {movement.registeredBy}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                        {movement.direction === "in" ? "Entrada" : "Salida"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 pb-4 sm:hidden">
            {movements.map((movement) => (
              <div
                key={movement.id}
                className="rounded-xl border border-slate-100 bg-slate-50 p-4"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="min-w-0 break-words text-sm font-semibold text-slate-900">
                    {movement.folio}
                  </span>
                  <span className="inline-flex shrink-0 items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {movement.direction === "in" ? "Entrada" : "Salida"}
                  </span>
                </div>
                <div className="space-y-1.5 text-sm text-slate-600">
                  <DetailLine
                    label="Descripción"
                    value={movement.description}
                  />
                  <DetailLine
                    label="Monto"
                    value={formatCurrency(movement.amount)}
                    strong
                  />
                  <DetailLine
                    label="Fecha"
                    value={formatMovementDate(movement.registeredAt)}
                  />
                  <DetailLine label="Usuario" value={movement.registeredBy} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-between gap-2 sm:justify-start">
              <span className="text-sm font-semibold text-slate-900">
                Total de la categoría
              </span>
              <span className="text-lg font-bold text-slate-900">
                {formatCurrency(categoryTotal)}
              </span>
            </div>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailLine({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <p className="flex items-start gap-2">
      <span className="w-24 shrink-0 font-medium text-slate-500">{label}:</span>
      <span
        className={`min-w-0 break-words ${strong ? "font-semibold text-slate-900" : ""}`}
      >
        {value}
      </span>
    </p>
  );
}

function formatMovementDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return formatDateTime(date);
}
