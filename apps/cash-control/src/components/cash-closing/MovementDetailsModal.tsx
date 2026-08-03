"use client";

import { X } from "lucide-react";
import { useEffect, useId } from "react";
import { formatCurrency } from "@/lib/formatters";
import type { CashMovement, CashMovementCategory } from "@/types/cash-closing";

type MovementDetailsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  category: CashMovementCategory;
  movements: CashMovement[];
};

const CATEGORY_LABELS: Record<CashMovementCategory, string> = {
  opening_balance: "Saldo inicial",
  cash_deposit: "Depósitos recibidos",
  commission: "Comisiones cobradas",
  delivered_withdrawal: "Retiros entregados",
  owner_withdrawal: "Retiros del propietario",
  authorized_adjustment: "Ajustes autorizados",
};

export function MovementDetailsModal({
  isOpen,
  onClose,
  category,
  movements,
}: MovementDetailsModalProps) {
  const titleId = useId();
  const categoryTotal = movements.reduce((sum, movement) => sum + movement.amount, 0);
  const categoryLabel = CATEGORY_LABELS[category];

  useEffect(() => {
    if (isOpen) {
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
    }
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl animate-in fade-in zoom-in-95 duration-200 max-h-[90dvh]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 shrink-0">
          <h2
            id={titleId}
            className="text-lg font-bold text-slate-900 min-w-0 pr-4"
          >
            {categoryLabel}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5">
          {/* Desktop table */}
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
                    <td className="py-3 pr-4 font-medium text-slate-900 whitespace-nowrap">
                      {movement.folio}
                    </td>
                    <td className="py-3 pr-4 text-slate-700">{movement.description}</td>
                    <td className="py-3 pr-4 text-right font-medium text-slate-900 whitespace-nowrap">
                      {formatCurrency(movement.amount)}
                    </td>
                    <td className="py-3 pr-4 text-slate-500 whitespace-nowrap">
                      {movement.registeredAt}
                    </td>
                    <td className="py-3 pr-4 text-slate-500 whitespace-nowrap">
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

          {/* Mobile cards */}
          <div className="space-y-3 pb-4 sm:hidden">
            {movements.map((movement) => (
              <div
                key={movement.id}
                className="rounded-xl border border-slate-100 bg-slate-50 p-4"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900 min-w-0 break-words">
                    {movement.folio}
                  </span>
                  <span className="shrink-0 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {movement.direction === "in" ? "Entrada" : "Salida"}
                  </span>
                </div>
                <div className="space-y-1.5 text-sm text-slate-600">
                  <p className="flex items-center gap-2">
                    <span className="font-medium text-slate-500 shrink-0 w-16">Descripción:</span>
                    <span className="min-w-0 break-words">{movement.description}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="font-medium text-slate-500 shrink-0 w-16">Monto:</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(movement.amount)}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="font-medium text-slate-500 shrink-0 w-16">Fecha:</span>
                    <span>{movement.registeredAt}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="font-medium text-slate-500 shrink-0 w-16">Usuario:</span>
                    <span>{movement.registeredBy}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-100 px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <span className="text-sm font-semibold text-slate-900">Total de la categoría</span>
              <span className="text-lg font-bold text-slate-900">{formatCurrency(categoryTotal)}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 w-full sm:w-auto"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}