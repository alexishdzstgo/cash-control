"use client";

import { X, Eye } from "lucide-react";
import { useEffect, useId } from "react";
import { formatCurrency } from "@/lib/formatters";
import type { ReservedOperation } from "@/types/balance";

type ReservedFundsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  resourceName: string;
  resourceType: "cash" | "bank";
  operations: ReservedOperation[];
};

export function ReservedFundsModal({
  isOpen,
  onClose,
  resourceName,
  resourceType,
  operations,
}: ReservedFundsModalProps) {
  const titleId = useId();
  const totalReserved = operations.reduce(
    (sum, op) => sum + op.amount,
    0
  );

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const title =
    resourceType === "cash"
      ? `Retiros pendientes — ${resourceName}`
      : `Saldo reservado — ${resourceName}`;

  const description =
    resourceType === "cash"
      ? "Estos retiros pendientes forman parte del efectivo reservado."
      : "Estos depósitos pendientes forman parte del saldo reservado de la cuenta.";

  const typeLabel =
    resourceType === "cash" ? "retiros" : "depósitos";

  const emptyState = operations.length === 0;

  if (emptyState) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-3 sm:p-6"
        onClick={onClose}
      >
        <div
          className="my-6 w-full max-w-3xl animate-in fade-in zoom-in-95 rounded-2xl bg-white shadow-xl duration-200"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2
              id={titleId}
              className="text-lg font-bold text-slate-900 min-w-0 pr-4"
            >
              {title}
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

          <div className="p-8 text-center">
            <p className="text-sm text-slate-500">
              Esta cuenta no tiene {typeLabel} pendientes.
            </p>
          </div>

          {/* Footer */}
          <div className="flex justify-end border-t border-slate-100 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 sm:w-auto w-full"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
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
        {/* Header — always visible */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 shrink-0">
          <h2
            id={titleId}
            className="text-lg font-bold text-slate-900 min-w-0 pr-4"
          >
            {title}
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

        {/* Description */}
        <p className="px-5 pb-3 pt-1 text-sm text-slate-500 shrink-0">
          {description}
        </p>

        {/* Scrollable content */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5">
          {/* Desktop table */}
          <div className="hidden sm:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="pb-3 pr-4">Folio</th>
                  <th className="pb-3 pr-4">Tipo</th>
                  <th className="pb-3 pr-4">Cliente</th>
                  <th className="pb-3 pr-4 text-right">
                    Monto
                  </th>
                  <th className="pb-3 pr-4">Registrado</th>
                  <th className="pb-3 pr-4">Registró</th>
                  <th className="pb-3 pr-4">Estado</th>
                  <th className="pb-3 text-right">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody>
                {operations.map((op) => (
                  <tr
                    key={op.id}
                    className="border-b border-slate-50 last:border-none"
                  >
                    <td className="py-3 pr-4 font-medium text-slate-900 whitespace-nowrap">
                      {op.folio}
                    </td>
                    <td className="py-3 pr-4 text-slate-500 whitespace-nowrap">
                      {op.type === "retiro"
                        ? "Retiro"
                        : "Depósito"}
                    </td>
                    <td className="py-3 pr-4 text-slate-700">
                      {op.customerName}
                    </td>
                    <td className="py-3 pr-4 text-right font-medium text-slate-900 whitespace-nowrap">
                      {formatCurrency(op.amount)}
                    </td>
                    <td className="py-3 pr-4 text-slate-500 whitespace-nowrap">
                      {op.registeredAt}
                    </td>
                    <td className="py-3 pr-4 text-slate-500 whitespace-nowrap">
                      {op.registeredBy}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200 whitespace-nowrap">
                        Pendiente
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-800 whitespace-nowrap"
                      >
                        <Eye className="h-3.5 w-3.5 shrink-0" />
                        Ver operación
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 pb-4 sm:hidden">
            {operations.map((op) => (
              <div
                key={op.id}
                className="rounded-xl border border-slate-100 bg-slate-50 p-4"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900 min-w-0 break-words">
                    {op.folio}
                  </span>
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                    Pendiente
                  </span>
                </div>
                <div className="space-y-1.5 text-sm text-slate-600">
                  <p className="flex items-center gap-2">
                    <span className="font-medium text-slate-500 shrink-0 w-16">
                      Tipo:
                    </span>
                    <span>
                      {op.type === "retiro"
                        ? "Retiro"
                        : "Depósito"}
                    </span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="font-medium text-slate-500 shrink-0 w-16">
                      Cliente:
                    </span>
                    <span className="min-w-0 break-words">
                      {op.customerName}
                    </span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="font-medium text-slate-500 shrink-0 w-16">
                      Monto:
                    </span>
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(op.amount)}
                    </span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="font-medium text-slate-500 shrink-0 w-16">
                      Fecha:
                    </span>
                    <span>{op.registeredAt}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="font-medium text-slate-500 shrink-0 w-16">
                      Registró:
                    </span>
                    <span>{op.registeredBy}</span>
                  </p>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-800"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Ver operación
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer — always visible */}
        <div className="shrink-0 border-t border-slate-100 px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <span className="text-sm font-semibold text-slate-900">
                Total reservado
              </span>
              <span className="text-lg font-bold text-slate-900">
                {formatCurrency(totalReserved)}
              </span>
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