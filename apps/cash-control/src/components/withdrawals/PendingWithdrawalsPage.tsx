"use client";

import { Banknote, CheckCircle2, Eye, ListChecks } from "lucide-react";
import { useMemo, useState } from "react";
import { useBusinessFunds } from "@/components/business-funds/BusinessFundsContext";
import { OperationDetailsModal } from "@/components/history/OperationDetailsModal";
import { useMockSession } from "@/components/session/MockSessionContext";
import {
  ModalInfoItem,
  ModalSection,
  ModalShell,
} from "@/components/shared/ModalShell";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { focusFirstInvalidField } from "@/lib/formValidationFocus";
import type { Operation } from "@/types/operation";

const pendingReasonLabels: Record<string, string> = {
  customer_later: "Cliente recogerá después",
  insufficient_cash: "Falta de efectivo disponible",
  operational_limit: "Límite operativo",
  other: "Otro",
};

export function PendingWithdrawalsPage() {
  const { operations, deliverPendingWithdrawal } = useBusinessFunds();
  const { authenticatedUser } = useMockSession();

  const [selectedOperation, setSelectedOperation] = useState<Operation | null>(
    null,
  );

  const [operationToDeliver, setOperationToDeliver] =
    useState<Operation | null>(null);
  const [receiverName, setReceiverName] = useState("");
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [isDelivering, setIsDelivering] = useState(false);

  const pendingWithdrawals = useMemo(() => {
    return operations
      .filter(
        (operation) =>
          operation.type === "retiro" && operation.status === "pendiente",
      )
      .sort(
        (firstOperation, secondOperation) =>
          new Date(secondOperation.createdAt).getTime() -
          new Date(firstOperation.createdAt).getTime(),
      );
  }, [operations]);

  const pendingAmount = useMemo(() => {
    return pendingWithdrawals.reduce(
      (total, operation) => total + operation.amount,
      0,
    );
  }, [pendingWithdrawals]);

  function openDeliveryDialog(operation: Operation) {
    setOperationToDeliver(operation);
    setReceiverName("");
    setDeliveryError(null);
  }

  function closeDeliveryDialog() {
    if (isDelivering) return;
    setOperationToDeliver(null);
    setReceiverName("");
    setDeliveryError(null);
  }

  function confirmDelivery() {
    if (!operationToDeliver || isDelivering) return;

    if (receiverName.trim() === "") {
      setDeliveryError("Captura el nombre de quien recibe.");
      focusFirstInvalidField({
        errors: { receiverName: "Captura el nombre de quien recibe." },
        fieldOrder: ["receiverName"],
        fieldSelector: {
          receiverName: "#pending-delivery-receiver",
        },
      });
      return;
    }

    setIsDelivering(true);
    const result = deliverPendingWithdrawal({
      operationId: operationToDeliver.id,
      receiverName,
      deliveredBy: authenticatedUser?.userName ?? "Usuario no disponible",
    });

    if (!result.success) {
      setDeliveryError(result.error ?? "No se pudo confirmar la entrega.");
      setIsDelivering(false);
      return;
    }

    setOperationToDeliver(null);
    setReceiverName("");
    setDeliveryError(null);
    setIsDelivering(false);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <SummaryCard
          title="Retiros pendientes"
          value={String(pendingWithdrawals.length)}
          description="Operaciones por entregar"
          icon={<ListChecks className="h-5 w-5" aria-hidden="true" />}
        />

        <SummaryCard
          title="Efectivo pendiente"
          value={formatCurrency(pendingAmount)}
          description="Monto todavía no entregado"
          icon={<Banknote className="h-5 w-5" aria-hidden="true" />}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-500 font-semibold tracking-wide">
              <tr>
                <th className="px-4 py-3">Folio</th>
                <th className="px-4 py-3 text-right">Monto</th>
                <th className="px-4 py-3">Banco</th>
                <th className="px-4 py-3">Motivo</th>
                <th className="px-4 py-3">Registró</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {pendingWithdrawals.map((operation) => (
                <tr
                  key={operation.id}
                  className="bg-white transition-colors duration-200 hover:bg-slate-50/70"
                >
                  <td className="px-4 py-3 font-mono font-medium tabular-nums text-slate-800">
                    {operation.bankFolio}
                  </td>

                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                    {formatCurrency(operation.amount)}
                  </td>

                  <td className="px-4 py-3 text-slate-600">
                    {operation.bankFrom}
                  </td>

                  <td className="px-4 py-3 text-slate-700">
                    {getPendingReasonLabel(operation)}
                  </td>

                  <td className="px-4 py-3 text-slate-600">
                    {operation.createdBy}
                  </td>

                  <td className="px-4 py-3 text-slate-500">
                    {formatDateTime(operation.createdAt)}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        title="Ver detalle"
                        aria-label={`Ver detalle de la operación ${operation.bankFolio}`}
                        onClick={() => setSelectedOperation(operation)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                      >
                        <Eye aria-hidden="true" className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => openDeliveryDialog(operation)}
                        className="btn-primary h-9 shrink-0 whitespace-nowrap px-3"
                      >
                        <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                        Confirmar entrega
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {pendingWithdrawals.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    No hay retiros pendientes de entrega.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <OperationDetailsModal
        operation={selectedOperation}
        onClose={() => setSelectedOperation(null)}
      />

      <ConfirmPendingWithdrawalDeliveryDialog
        operation={operationToDeliver}
        receiverName={receiverName}
        error={deliveryError}
        isDelivering={isDelivering}
        onReceiverNameChange={(value) => {
          setReceiverName(value);
          setDeliveryError(null);
        }}
        onClose={closeDeliveryDialog}
        onConfirm={confirmDelivery}
      />
    </div>
  );
}

function ConfirmPendingWithdrawalDeliveryDialog({
  operation,
  receiverName,
  error,
  isDelivering,
  onReceiverNameChange,
  onClose,
  onConfirm,
}: {
  operation: Operation | null;
  receiverName: string;
  error: string | null;
  isDelivering: boolean;
  onReceiverNameChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!operation) return null;

  return (
    <ModalShell
      title="Confirmar entrega de efectivo"
      description="Registra la entrega física del efectivo apartado para este retiro."
      onClose={onClose}
      maxWidth="lg"
      zIndex="high"
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={isDelivering}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={onConfirm}
            disabled={isDelivering}
          >
            {isDelivering ? "Confirmando..." : "Confirmar entrega"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <ModalSection>
          <div className="grid gap-3 md:grid-cols-2">
            <ModalInfoItem
              label="Folio/referencia"
              value={operation.bankFolio}
            />
            <ModalInfoItem
              label="Banco"
              value={operation.bankFrom ?? "Banco no disponible"}
            />
            <ModalInfoItem
              label="Monto"
              value={formatCurrency(operation.amount)}
            />
            <ModalInfoItem
              label="Motivo de pendiente"
              value={getPendingReasonLabel(operation)}
            />
          </div>
        </ModalSection>

        <div>
          <label
            htmlFor="pending-delivery-receiver"
            className="mb-2 block text-sm font-semibold text-slate-700"
          >
            Persona que recibe
            <span className="ml-1 text-red-500">*</span>
          </label>
          <input
            id="pending-delivery-receiver"
            type="text"
            value={receiverName}
            onChange={(event) => onReceiverNameChange(event.target.value)}
            className="field-input px-4 py-3"
            placeholder="Nombre completo"
            aria-invalid={error ? true : undefined}
            aria-describedby={
              error ? "pending-delivery-receiver-error" : undefined
            }
          />
          {error && (
            <p
              id="pending-delivery-receiver-error"
              className="mt-2 text-sm font-medium text-red-600"
            >
              {error}
            </p>
          )}
        </div>
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

type SummaryCardProps = {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
};

function SummaryCard({ title, value, description, icon }: SummaryCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>

          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>

          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          {icon}
        </div>
      </div>
    </article>
  );
}
