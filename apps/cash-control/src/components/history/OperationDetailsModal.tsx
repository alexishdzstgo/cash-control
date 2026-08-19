"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import type { Operation } from "@/types/operation";
import type { WithdrawalCommissionMode } from "@/types/withdrawal";
import { OperationStatusBadge } from "./OperationStatusBadge";

type OperationDetailsModalProps = {
  operation: Operation | null;
  onClose: () => void;
};

const withdrawalCommissionModeLabels: Record<WithdrawalCommissionMode, string> =
  {
    deposited: "Comision depositada",
    cash: "Comision pagada en efectivo",
    deducted: "Comision descontada",
  };

export function OperationDetailsModal({
  operation,
  onClose,
}: OperationDetailsModalProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    if (operation) {
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [operation, onClose]);

  if (!operation) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4">
      <button
        type="button"
        aria-label="Cerrar detalle"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div className="cc-modal-surface relative z-10 my-6 w-full max-w-2xl animate-in overflow-hidden rounded-2xl shadow-xl fade-in zoom-in-95 duration-200">
        <div className="cc-modal-header flex items-center justify-between px-5 py-4">
          <div>
            <p className="cc-modal-description text-sm font-medium">
              Detalle de operacion
            </p>
            <h2 className="cc-modal-title text-lg font-bold">
              Folio {operation.bankFolio}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-2">
          <DetailItem label="Tipo" value={operation.type} />
          <DetailItem
            label="Estado"
            value={<OperationStatusBadge status={operation.status} />}
          />
          <DetailItem label="Monto" value={formatCurrency(operation.amount)} />
          <DetailItem
            label="Comision"
            value={formatCurrency(operation.commission)}
          />
          <DetailItem
            label={
              operation.type === "deposito"
                ? "Banco de emision"
                : "Banco de recepcion"
            }
            value={
              operation.type === "deposito"
                ? operation.bankTo
                : operation.bankFrom
            }
          />
          <DetailItem
            label="Movimiento en caja"
            value={
              operation.type === "deposito"
                ? "Efectivo recibido"
                : "Efectivo entregado"
            }
          />
          <DetailItem
            label="Nombre de quien envia"
            value={operation.senderName}
          />
          <DetailItem
            label="Nombre de quien recibe"
            value={operation.receiverName}
          />
          {operation.destinationAccountLast4 && (
            <DetailItem
              label="Cuenta destino"
              value={`**** ${operation.destinationAccountLast4}`}
            />
          )}
          {operation.withdrawalCommissionMode && (
            <DetailItem
              label="Modo de comision"
              value={
                withdrawalCommissionModeLabels[
                  operation.withdrawalCommissionMode
                ]
              }
            />
          )}
          {operation.customerCashReceived !== undefined && (
            <DetailItem
              label="Efectivo entregado"
              value={formatCurrency(operation.customerCashReceived)}
            />
          )}
          <DetailItem
            label="Usuario que registro"
            value={operation.createdBy}
          />
          <DetailItem
            label="Fecha y hora"
            value={formatDateTime(operation.createdAt)}
          />
        </div>

        {operation.isEdited && (
          <div className="mx-5 mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            Esta operacion fue editada. Mas adelante se mostrara aqui el
            historial de cambios.
          </div>
        )}

        <div className="flex justify-end border-t border-slate-200 px-5 py-4">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

type DetailItemProps = {
  label: string;
  value: React.ReactNode;
};

function DetailItem({ label, value }: DetailItemProps) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <p className="text-xs font-medium uppercase text-slate-400">{label}</p>
      <div className="mt-1 text-sm font-semibold text-slate-800">{value}</div>
    </div>
  );
}
