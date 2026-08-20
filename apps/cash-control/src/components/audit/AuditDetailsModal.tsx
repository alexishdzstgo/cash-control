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
  getCorrectionDate,
  getCorrectionReason,
  getCorrectionUser,
} from "@/lib/audit";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import type { Operation } from "@/types/operation";

type AuditDetailsModalProps = {
  operation: Operation | null;
  onClose: () => void;
};

export function AuditDetailsModal({
  operation,
  onClose,
}: AuditDetailsModalProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    if (operation) {
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [operation, onClose]);

  if (!operation) {
    return null;
  }

  return (
    <ModalShell
      title={`Folio ${operation.bankFolio}`}
      description="Detalle de auditoria"
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
            Informacion de la operacion
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <ModalInfoItem
              label="Operacion"
              value={<OperationTypeBadge type={operation.type} />}
            />
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
              label="Banco origen"
              value={operation.bankFrom ?? "No disponible"}
            />
            <ModalInfoItem
              label="Banco destino"
              value={operation.bankTo ?? "No disponible"}
            />
            <ModalInfoItem label="Quien envia" value={operation.senderName} />
            <ModalInfoItem
              label="Quien recibe"
              value={operation.receiverName || "No registrado"}
            />
          </div>
        </ModalSection>

        <ModalSection>
          <h3 className="mb-4 text-sm font-bold text-slate-900">
            Auditoria y correccion
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <ModalInfoItem
              label="Usuario"
              value={getCorrectionUser(operation)}
            />
            <ModalInfoItem
              label="Fecha de correccion"
              value={formatDateTime(getCorrectionDate(operation))}
            />
            <ModalInfoItem label="Registrado por" value={operation.createdBy} />
            <ModalInfoItem
              label="Fecha de registro"
              value={formatDateTime(operation.createdAt)}
            />
            <ModalInfoItem
              className="md:col-span-2"
              label="Motivo registrado"
              value={getCorrectionReason(operation)}
            />
            <ModalInfoItem
              className="md:col-span-2"
              label="Regla de comision"
              value={
                operation.appliedCommissionSnapshot
                  ? `Regla ${operation.appliedCommissionSnapshot.ruleId} - v${operation.appliedCommissionSnapshot.ruleVersion}`
                  : "Regla aplicada no disponible para esta operacion historica"
              }
            />
          </div>
        </ModalSection>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          El historial de valores anteriores estara disponible al conectar la
          base de datos.
        </div>
      </div>
    </ModalShell>
  );
}
