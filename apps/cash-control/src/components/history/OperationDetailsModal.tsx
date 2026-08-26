"use client";

import { useEffect } from "react";
import {
  ModalInfoItem,
  ModalSection,
  ModalShell,
} from "@/components/shared/ModalShell";
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

const pendingReasonLabels: Record<string, string> = {
  customer_later: "Cliente recogerá después",
  insufficient_cash: "Falta de efectivo disponible",
  operational_limit: "Límite operativo",
  other: "Otro",
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
            <ModalInfoItem
              label={
                operation.type === "retiro"
                  ? "Persona que envía"
                  : "Nombre de quien envia"
              }
              value={operation.senderName}
            />
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
                value={getPendingReasonLabel(operation)}
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

function getPendingReasonLabel(operation: Operation): string {
  if (operation.pendingReason === "other") {
    return operation.pendingReasonDetails || "Otro";
  }

  return operation.pendingReason
    ? (pendingReasonLabels[operation.pendingReason] ?? operation.pendingReason)
    : "Sin motivo registrado";
}
