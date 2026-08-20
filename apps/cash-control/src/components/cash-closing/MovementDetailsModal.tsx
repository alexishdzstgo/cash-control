"use client";

import { useEffect } from "react";
import { ModalSection, ModalShell } from "@/components/shared/ModalShell";
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
    <ModalShell
      title={categoryLabel}
      description={CASH_CLOSING_CATEGORY_META[category].helperText}
      onClose={onClose}
      maxWidth="xl"
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-2 sm:justify-start">
            <span className="text-sm font-semibold text-slate-900">
              Total de la categoria
            </span>
            <span className="text-lg font-bold text-slate-900">
              {formatCurrency(categoryTotal)}
            </span>
          </div>
          <button type="button" onClick={onClose} className="btn-secondary">
            Cerrar
          </button>
        </div>
      }
    >
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white sm:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Folio</th>
              <th className="px-4 py-3">Descripcion</th>
              <th className="px-4 py-3 text-right">Monto</th>
              <th className="px-4 py-3">Fecha y hora</th>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Tipo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {movements.map((movement) => (
              <tr key={movement.id} className="bg-white">
                <td className="px-4 py-3 font-semibold whitespace-nowrap text-slate-900">
                  {movement.folio}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {movement.description}
                </td>
                <td className="px-4 py-3 text-right font-semibold whitespace-nowrap text-slate-900">
                  {formatCurrency(movement.amount)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                  {formatMovementDate(movement.registeredAt)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                  {movement.registeredBy}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                    {movement.direction === "in" ? "Entrada" : "Salida"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 sm:hidden">
        {movements.map((movement) => (
          <ModalSection key={movement.id}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="min-w-0 break-words text-sm font-semibold text-slate-900">
                {movement.folio}
              </span>
              <span className="inline-flex shrink-0 items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                {movement.direction === "in" ? "Entrada" : "Salida"}
              </span>
            </div>
            <div className="space-y-1.5 text-sm text-slate-600">
              <DetailLine label="Descripcion" value={movement.description} />
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
          </ModalSection>
        ))}
      </div>
    </ModalShell>
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
