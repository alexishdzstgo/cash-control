"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import { OperationStatusBadge } from "@/components/history/OperationStatusBadge";
import { OperationTypeBadge } from "@/components/history/OperationTypeBadge";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4">
      <button
        type="button"
        aria-label="Cerrar detalle"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div className="cc-modal-surface relative z-10 my-6 w-full max-w-3xl animate-in overflow-hidden rounded-2xl shadow-xl fade-in zoom-in-95 duration-200">
        <div className="cc-modal-header flex items-center justify-between px-5 py-4">
          <div>
            <p className="cc-modal-description text-sm font-medium">
              Detalle de auditoría
            </p>
            <h2 className="cc-modal-title text-lg font-bold">
              Folio {operation.bankFolio}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar detalle"
            className="rounded-xl p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-2">
          <DetailItem
            label="Operación"
            value={<OperationTypeBadge type={operation.type} />}
          />
          <DetailItem
            label="Estado"
            value={<OperationStatusBadge status={operation.status} />}
          />
          <DetailItem label="Usuario" value={getCorrectionUser(operation)} />
          <DetailItem
            label="Fecha de corrección"
            value={formatDateTime(getCorrectionDate(operation))}
          />
          <DetailItem label="Monto" value={formatCurrency(operation.amount)} />
          <DetailItem
            label="Comisión"
            value={formatCurrency(operation.commission)}
          />
          <DetailItem
            label="Banco origen"
            value={operation.bankFrom ?? "No disponible"}
          />
          <DetailItem
            label="Banco destino"
            value={operation.bankTo ?? "No disponible"}
          />
          <DetailItem label="Quien envía" value={operation.senderName} />
          <DetailItem
            label="Quien recibe"
            value={operation.receiverName || "No registrado"}
          />
          <DetailItem label="Registrado por" value={operation.createdBy} />
          <DetailItem
            label="Fecha de registro"
            value={formatDateTime(operation.createdAt)}
          />
        </div>

        <div className="mx-5 mb-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase text-slate-400">
            Motivo registrado
          </p>
          <p className="mt-1 text-sm font-medium text-slate-800">
            {getCorrectionReason(operation)}
          </p>
        </div>

        <div className="mx-5 mb-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase text-slate-400">
            Regla de comisión
          </p>
          <p className="mt-1 text-sm font-medium text-slate-800">
            {operation.appliedCommissionSnapshot
              ? `Regla ${operation.appliedCommissionSnapshot.ruleId} · v${operation.appliedCommissionSnapshot.ruleVersion}`
              : "Regla aplicada no disponible para esta operación histórica"}
          </p>
        </div>

        <div className="mx-5 mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          El historial de valores anteriores estará disponible al conectar la
          base de datos.
        </div>

        <div className="flex justify-end border-t border-slate-200 px-5 py-4">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <p className="text-xs font-medium uppercase text-slate-400">{label}</p>
      <div className="mt-1 text-sm font-semibold text-slate-800">{value}</div>
    </div>
  );
}
