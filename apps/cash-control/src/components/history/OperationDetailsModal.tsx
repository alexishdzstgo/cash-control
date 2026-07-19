"use client";
import { OperationStatusBadge } from "./OperationStatusBadge";
import {  X } from "lucide-react";
import { useEffect } from "react";
import type { Operation } from "@/types/operation";
import { formatCurrency, formatDateTime } from "@/lib/formatters";

type OperationDetailsModalProps = {
  operation: Operation | null;
  onClose: () => void;
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
    <div
    className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4"
    onClick={onClose}
    >
      <div
        className="my-6 w-full max-w-2xl animate-in fade-in zoom-in-95 rounded-2xl bg-white shadow-xl duration-200"
        onClick={(event) => event.stopPropagation()}
     > 
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-sm font-medium text-emerald-600">
              Detalle de operación
            </p>
            <h2 className="text-lg font-bold text-slate-900">
              Folio {operation.bankFolio}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
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
  label="Comisión"
  value={formatCurrency(operation.commission)}
/>
          <DetailItem label="Banco origen" value={operation.bankFrom} />
          <DetailItem label="Banco destino" value={operation.bankTo} />
          <DetailItem label="Nombre de quien envía" value={operation.senderName} />
          <DetailItem
            label="Nombre de quien recibe"
            value={operation.receiverName}
          />
          <DetailItem label="Usuario que registró" value={operation.createdBy} />
          <DetailItem
            label="Fecha y hora"
            value={formatDateTime(operation.createdAt)}
          />
        </div>

        {operation.isEdited && (
          <div className="mx-5 mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            Esta operación fue editada. Más adelante se mostrará aquí el
            historial de cambios.
          </div>
        )}



        <div className="flex justify-end border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
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
      <div className="mt-1 text-sm font-semibold text-slate-800">
  {value}
</div>
    </div>
  );
}

