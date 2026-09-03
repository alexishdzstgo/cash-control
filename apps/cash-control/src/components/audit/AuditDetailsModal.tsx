"use client";

import { useEffect } from "react";
import { OperationStatusBadge } from "@/components/history/OperationStatusBadge";
import { OperationTypeBadge } from "@/components/history/OperationTypeBadge";
import {
  ModalInfoItem,
  ModalSection,
  ModalShell,
} from "@/components/shared/ModalShell";
import {
  getCorrectionReason,
  getCorrectionSnapshotChanges,
  type OperationAuditEvent,
} from "@/lib/audit";
import { formatCurrency, formatDateTime } from "@/lib/formatters";

type AuditDetailsModalProps = {
  event: OperationAuditEvent | null;
  onClose: () => void;
};

export function AuditDetailsModal({ event, onClose }: AuditDetailsModalProps) {
  useEffect(() => {
    function handleKeyDown(keyboardEvent: KeyboardEvent) {
      if (keyboardEvent.key === "Escape") {
        onClose();
      }
    }

    if (event) {
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [event, onClose]);

  if (!event) {
    return null;
  }

  const operation = event.operation;
  const changes = event.correction
    ? getCorrectionSnapshotChanges({
        before: event.correction.before,
        after: event.correction.after,
      })
    : [];

  return (
    <ModalShell
      title={`Folio ${operation.bankFolio}`}
      description={
        event.kind === "correction"
          ? "Detalle de corrección financiera"
          : "Detalle de aclaración"
      }
      onClose={onClose}
      closeOnOverlayClick
      maxWidth="xl"
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
            Información de la operación
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <ModalInfoItem
              label="Operación"
              value={<OperationTypeBadge type={operation.type} />}
            />
            <ModalInfoItem
              label="Estado"
              value={<OperationStatusBadge status={operation.status} />}
            />
            <ModalInfoItem
              label="Monto actual"
              value={formatCurrency(operation.amount)}
            />
            <ModalInfoItem
              label="Comisión actual"
              value={formatCurrency(operation.commission)}
            />
            <ModalInfoItem
              label="Banco origen"
              value={operation.bankFrom ?? "No disponible"}
            />
            <ModalInfoItem
              label="Banco destino"
              value={operation.bankTo ?? "No disponible"}
            />
            <ModalInfoItem label="Registrado por" value={operation.createdBy} />
            <ModalInfoItem
              label="Fecha de registro"
              value={formatDateTime(operation.createdAt)}
            />
          </div>
        </ModalSection>

        <ModalSection>
          <h3 className="mb-4 text-sm font-bold text-slate-900">
            {event.kind === "correction" ? "Corrección" : "Aclaración"}
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <ModalInfoItem label="Usuario" value={event.createdBy} />
            <ModalInfoItem
              label="Fecha"
              value={formatDateTime(event.createdAt)}
            />
            <ModalInfoItem
              className="md:col-span-2"
              label="Motivo"
              value={getCorrectionReason(event)}
            />
            {event.clarification?.note && (
              <ModalInfoItem
                className="md:col-span-2"
                label="Nota"
                value={event.clarification.note}
              />
            )}
            {event.clarification?.reference && (
              <ModalInfoItem
                className="md:col-span-2"
                label="Referencia adicional"
                value={event.clarification.reference}
              />
            )}
          </div>
        </ModalSection>

        {event.kind === "correction" && (
          <ModalSection>
            <h3 className="mb-4 text-sm font-bold text-slate-900">
              Valores modificados
            </h3>
            <div className="space-y-3">
              {changes.map((change) => (
                <div
                  key={change.label}
                  className="grid gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm md:grid-cols-[160px_1fr]"
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
          </ModalSection>
        )}
      </div>
    </ModalShell>
  );
}
