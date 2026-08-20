"use client";

import { Eye } from "lucide-react";
import { useEffect } from "react";
import {
  ModalInfoItem,
  ModalSection,
  ModalShell,
} from "@/components/shared/ModalShell";
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
  const totalReserved = operations.reduce((sum, op) => sum + op.amount, 0);

  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

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
      ? `Retiros pendientes - ${resourceName}`
      : `Saldo reservado - ${resourceName}`;

  const description =
    resourceType === "cash"
      ? "Estos retiros pendientes forman parte del efectivo reservado."
      : "Estos depositos pendientes forman parte del saldo reservado de la cuenta.";

  const typeLabel = resourceType === "cash" ? "retiros" : "depositos";
  const emptyState = operations.length === 0;

  return (
    <ModalShell
      title={title}
      description={description}
      onClose={onClose}
      closeOnOverlayClick
      maxWidth="xl"
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-2 sm:justify-start">
            <span className="text-sm font-semibold text-slate-900">
              Total reservado
            </span>
            <span className="text-lg font-bold text-slate-900">
              {formatCurrency(totalReserved)}
            </span>
          </div>
          <button type="button" onClick={onClose} className="btn-secondary">
            Cerrar
          </button>
        </div>
      }
    >
      {emptyState ? (
        <ModalSection className="text-center">
          <p className="text-sm text-slate-600">
            Esta cuenta no tiene {typeLabel} pendientes.
          </p>
        </ModalSection>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white sm:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Folio</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                  <th className="px-4 py-3">Registrado</th>
                  <th className="px-4 py-3">Registro</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Accion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {operations.map((op) => (
                  <tr key={op.id} className="bg-white">
                    <td className="px-4 py-3 font-semibold whitespace-nowrap text-slate-900">
                      {op.folio}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {op.type === "retiro" ? "Retiro" : "Deposito"}
                    </td>
                    <td className="px-4 py-3 text-slate-900">
                      {op.customerName}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap text-slate-900">
                      {formatCurrency(op.amount)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {op.registeredAt}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {op.registeredBy}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                        Pendiente
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 transition hover:text-slate-900"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Ver operacion
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 sm:hidden">
            {operations.map((op) => (
              <ModalSection key={op.id}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    {op.folio}
                  </span>
                  <span className="inline-flex shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                    Pendiente
                  </span>
                </div>
                <div className="grid gap-3">
                  <ModalInfoItem
                    label="Tipo"
                    value={op.type === "retiro" ? "Retiro" : "Deposito"}
                  />
                  <ModalInfoItem label="Cliente" value={op.customerName} />
                  <ModalInfoItem
                    label="Monto"
                    value={formatCurrency(op.amount)}
                  />
                  <ModalInfoItem label="Fecha" value={op.registeredAt} />
                  <ModalInfoItem label="Registro" value={op.registeredBy} />
                </div>
              </ModalSection>
            ))}
          </div>
        </>
      )}
    </ModalShell>
  );
}
