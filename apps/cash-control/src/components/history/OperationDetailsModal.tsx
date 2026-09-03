"use client";

import { useEffect } from "react";
import {
  ModalInfoItem,
  ModalSection,
  ModalShell,
} from "@/components/shared/ModalShell";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { getPendingWithdrawalReasonLabel } from "@/lib/pendingWithdrawalReasons";
import type { Operation, OperationCorrectionSnapshot } from "@/types/operation";
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
  const corrections = [...(operation.corrections ?? [])].sort(
    (firstCorrection, secondCorrection) =>
      new Date(secondCorrection.createdAt).getTime() -
      new Date(firstCorrection.createdAt).getTime(),
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

        {corrections.length > 0 && (
          <ModalSection>
            <h3 className="mb-4 text-sm font-bold text-slate-900">
              Correcciones
            </h3>
            <div className="space-y-4">
              {corrections.map((correction) => {
                const changes = getCorrectionChanges(
                  correction.before,
                  correction.after,
                );

                return (
                  <div
                    key={correction.id}
                    className="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3"
                  >
                    <p className="text-xs font-medium text-slate-500">
                      {formatDateTime(correction.createdAt)} ·{" "}
                      {correction.createdBy}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      <span className="font-semibold text-slate-800">
                        Motivo:
                      </span>{" "}
                      {correction.reason}
                    </p>
                    <div className="mt-3 space-y-2">
                      {changes.map((change) => (
                        <div
                          key={change.label}
                          className="grid gap-1 rounded-lg bg-white/80 px-3 py-2 text-sm md:grid-cols-[140px_1fr]"
                        >
                          <span className="font-semibold text-slate-700">
                            {change.label}
                          </span>
                          <span className="text-slate-600">
                            {change.before} →{" "}
                            <span className="font-semibold text-slate-900">
                              {change.after}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </ModalSection>
        )}

        {operation.isEdited && corrections.length === 0 && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            Esta operacion fue editada. Mas adelante se mostrara aqui el
            historial de cambios.
          </div>
        )}
      </div>
    </ModalShell>
  );
}

function getCorrectionChanges(
  before: OperationCorrectionSnapshot,
  after: OperationCorrectionSnapshot,
) {
  const changes: Array<{ label: string; before: string; after: string }> = [];

  addChange(changes, "Monto", before.amount, after.amount, formatCurrency);
  addChange(
    changes,
    "Comisión",
    before.commission,
    after.commission,
    formatCurrency,
  );
  addChange(changes, "Total", before.total, after.total, formatCurrency);
  addChange(changes, "Folio", before.bankFolio, after.bankFolio);
  addChange(changes, "Banco origen", before.bankFrom, after.bankFrom);
  addChange(changes, "Banco destino", before.bankTo, after.bankTo);
  addChange(
    changes,
    "Cuenta destino",
    before.destinationAccountLast4,
    after.destinationAccountLast4,
  );
  addChange(
    changes,
    "Referencia",
    before.destinationReference,
    after.destinationReference,
  );
  addChange(changes, "Quien recibe", before.receiverName, after.receiverName);
  addChange(
    changes,
    "Forma comisión",
    before.withdrawalCommissionMode,
    after.withdrawalCommissionMode,
  );
  addChange(
    changes,
    "Efectivo cliente",
    before.customerCashReceived,
    after.customerCashReceived,
    formatOptionalCurrency,
  );
  addChange(
    changes,
    "Movimiento banco",
    before.bankMovementAmount,
    after.bankMovementAmount,
    formatOptionalCurrency,
  );

  return changes;
}

function addChange<T>(
  changes: Array<{ label: string; before: string; after: string }>,
  label: string,
  beforeValue: T,
  afterValue: T,
  formatValue: (value: T) => string = formatOptionalValue,
) {
  if (beforeValue === afterValue) return;

  changes.push({
    label,
    before: formatValue(beforeValue),
    after: formatValue(afterValue),
  });
}

function formatOptionalValue(value: unknown): string {
  return value === undefined || value === "" ? "No registrado" : String(value);
}

function formatOptionalCurrency(value: number | undefined): string {
  return value === undefined ? "No registrado" : formatCurrency(value);
}
