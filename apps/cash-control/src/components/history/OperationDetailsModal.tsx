"use client";

import { useEffect } from "react";
import {
  ModalInfoItem,
  ModalSection,
  ModalShell,
} from "@/components/shared/ModalShell";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { getPendingWithdrawalReasonLabel } from "@/lib/pendingWithdrawalReasons";
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

  const clarifications = [...(operation.clarifications ?? [])].sort(
    (firstClarification, secondClarification) =>
      new Date(secondClarification.createdAt).getTime() -
      new Date(firstClarification.createdAt).getTime(),
  );

  return (
    <ModalShell
      title={`Folio ${operation.bankFolio}`}
      description="Detalle de operacion"
      onClose={onClose}
      closeOnOverlayClick
      maxWidth="lg"
      footer={
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cerrar
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <ModalSection>
          <h3 className="mb-4 text-sm font-bold text-slate-900">
            Informacion principal
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <ModalInfoItem label="Tipo" value={operation.type} />
            <ModalInfoItem
              label="Estado"
              value={<OperationStatusBadge status={operation.status} />}
            />
            <ModalInfoItem
              label="Monto"
              value={formatCurrency(operation.amount)}
            />
            <ModalInfoItem
              label="Comision"
              value={formatCurrency(operation.commission)}
            />
            <ModalInfoItem
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
            <ModalInfoItem
              label="Movimiento en caja"
              value={
                operation.type === "deposito"
                  ? "Efectivo recibido"
                  : "Efectivo entregado"
              }
            />
          </div>
        </ModalSection>

        <ModalSection>
          <h3 className="mb-4 text-sm font-bold text-slate-900">
            Personas y registro
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {operation.senderName && (
              <ModalInfoItem
                label={
                  operation.type === "retiro"
                    ? "Persona que envía"
                    : "Nombre de quien envia"
                }
                value={operation.senderName}
              />
            )}
            {operation.receiverName && (
              <ModalInfoItem
                label={
                  operation.type === "retiro"
                    ? "Persona que recibe"
                    : "Nombre de quien recibe"
                }
                value={operation.receiverName}
              />
            )}
            {operation.status === "pendiente" && (
              <ModalInfoItem
                label="Motivo de pendiente"
                value={getPendingWithdrawalReasonLabel(operation)}
              />
            )}
            {operation.destinationAccountLast4 && (
              <ModalInfoItem
                label="Cuenta destino"
                value={`**** ${operation.destinationAccountLast4}`}
              />
            )}
            {operation.withdrawalCommissionMode && (
              <ModalInfoItem
                label="Modo de comision"
                value={
                  withdrawalCommissionModeLabels[
                    operation.withdrawalCommissionMode
                  ]
                }
              />
            )}
            {operation.customerCashReceived !== undefined && (
              <ModalInfoItem
                label="Efectivo entregado"
                value={formatCurrency(operation.customerCashReceived)}
              />
            )}
            <ModalInfoItem
              label="Usuario que registro"
              value={operation.createdBy}
            />
            <ModalInfoItem
              label="Fecha y hora"
              value={formatDateTime(operation.createdAt)}
            />
          </div>
        </ModalSection>

        {clarifications.length > 0 && (
          <ModalSection>
            <h3 className="mb-4 text-sm font-bold text-slate-900">
              Aclaraciones
            </h3>
            <div className="space-y-3">
              {clarifications.map((clarification) => (
                <div
                  key={clarification.id}
                  className="rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3"
                >
                  <p className="text-sm font-bold text-slate-900">
                    {clarification.reason}
                  </p>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">
                    {clarification.note}
                  </p>
                  {clarification.reference && (
                    <p className="mt-3 text-sm text-slate-600">
                      <span className="font-semibold text-slate-800">
                        Referencia:
                      </span>{" "}
                      {clarification.reference}
                    </p>
                  )}
                  <p className="mt-3 text-xs font-medium text-slate-500">
                    {clarification.createdBy} ·{" "}
                    {formatDateTime(clarification.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </ModalSection>
        )}

        {operation.isEdited && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            Esta operacion fue editada. Mas adelante se mostrara aqui el
            historial de cambios.
          </div>
        )}
      </div>
    </ModalShell>
  );
}
