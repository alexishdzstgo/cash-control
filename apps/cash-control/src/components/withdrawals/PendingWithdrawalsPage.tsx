"use client";

import { Banknote, CheckCircle2, Eye, ListChecks } from "lucide-react";
import { useMemo, useState } from "react";
import { useBusinessFunds } from "@/components/business-funds/BusinessFundsContext";
import { useCommissionRules } from "@/components/commissions/CommissionRulesContext";
import { OperationDetailsModal } from "@/components/history/OperationDetailsModal";
import { useMockSession } from "@/components/session/MockSessionContext";
import {
  ModalInfoItem,
  ModalSection,
  ModalShell,
} from "@/components/shared/ModalShell";
import {
  calculateCommission,
  centsToPesos,
  pesosToCents,
} from "@/lib/commission";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { focusFirstInvalidField } from "@/lib/formValidationFocus";
import { getPendingWithdrawalReasonLabel } from "@/lib/pendingWithdrawalReasons";
import type { Operation } from "@/types/operation";
import type { WithdrawalCommissionMode } from "@/types/withdrawal";

type DeliveryErrors = Partial<
  Record<"receiverName" | "commissionMode" | "operation", string>
>;

const commissionModeOptions: Array<{
  value: WithdrawalCommissionMode;
  label: string;
  description: string;
}> = [
  {
    value: "deposited",
    label: "Comision depositada por el cliente",
    description: "La comision se recibio en el banco de recepcion.",
  },
  {
    value: "cash",
    label: "Comision pagada en efectivo",
    description: "La comision se recibio en caja fisica.",
  },
  {
    value: "deducted",
    label: "Comision descontada del retiro",
    description: "La comision se descuenta del efectivo entregado.",
  },
];

export function PendingWithdrawalsPage() {
  const { operations, deliverPendingWithdrawal } = useBusinessFunds();
  const { rules: commissionRules } = useCommissionRules();
  const { authenticatedUser } = useMockSession();

  const [selectedOperation, setSelectedOperation] = useState<Operation | null>(
    null,
  );

  const [operationToDeliver, setOperationToDeliver] =
    useState<Operation | null>(null);
  const [receiverName, setReceiverName] = useState("");
  const [commissionMode, setCommissionMode] = useState<
    WithdrawalCommissionMode | ""
  >("");
  const [deliveryErrors, setDeliveryErrors] = useState<DeliveryErrors>({});
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
    setCommissionMode("");
    setDeliveryErrors({});
  }

  function closeDeliveryDialog() {
    if (isDelivering) return;
    setOperationToDeliver(null);
    setReceiverName("");
    setCommissionMode("");
    setDeliveryErrors({});
  }

  function confirmDelivery() {
    if (!operationToDeliver || isDelivering) return;

    const errors: DeliveryErrors = {
      ...(receiverName.trim() === ""
        ? { receiverName: "Captura el nombre de quien recibe." }
        : {}),
      ...(commissionMode === ""
        ? { commissionMode: "Selecciona cómo se cobrará la comisión." }
        : {}),
    };

    if (Object.keys(errors).length > 0) {
      setDeliveryErrors(errors);
      focusFirstInvalidField({
        errors,
        fieldOrder: ["receiverName", "commissionMode"],
        fieldSelector: {
          receiverName: "#pending-delivery-receiver",
          commissionMode:
            '[data-validation-field="pendingDeliveryCommissionMode"]',
        },
      });
      return;
    }

    const selectedCommissionMode = commissionMode;
    if (selectedCommissionMode === "") return;

    const amountCents = pesosToCents(operationToDeliver.amount);
    const commissionCalculation = calculateCommission({
      amountCents,
      operationType: "retiro",
      rules: commissionRules,
    });
    if (commissionCalculation === null) {
      setDeliveryErrors({
        operation: "No hay una regla de comision para este monto.",
      });
      return;
    }

    const commissionAmount = centsToPesos(
      commissionCalculation.commissionAmountCents,
    );
    const customerCashReceived =
      selectedCommissionMode === "deducted"
        ? Math.max(0, operationToDeliver.amount - commissionAmount)
        : operationToDeliver.amount;
    const bankMovementAmount =
      selectedCommissionMode === "deposited"
        ? operationToDeliver.amount + commissionAmount
        : operationToDeliver.amount;
    const now = new Date().toISOString();

    setIsDelivering(true);
    const result = deliverPendingWithdrawal({
      operationId: operationToDeliver.id,
      receiverName,
      deliveredBy: authenticatedUser?.userName ?? "Usuario no disponible",
      commissionMode: selectedCommissionMode,
      commissionAmount,
      customerCashReceived,
      bankMovementAmount,
      appliedCommissionSnapshot: {
        operationAmountCents: amountCents,
        calculatedCommissionCents: commissionCalculation.commissionAmountCents,
        finalCommissionCents: commissionCalculation.commissionAmountCents,
        ruleId: commissionCalculation.ruleId,
        ruleVersion: commissionCalculation.ruleVersion,
        calculationType: commissionCalculation.calculationType,
        location: selectedCommissionMode === "deposited" ? "bank" : "cash",
        appliedAt: now,
      },
    });

    if (!result.success) {
      setDeliveryErrors({
        operation: result.error ?? "No se pudo confirmar la entrega.",
      });
      setIsDelivering(false);
      return;
    }

    setOperationToDeliver(null);
    setReceiverName("");
    setCommissionMode("");
    setDeliveryErrors({});
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
                    {getPendingWithdrawalReasonLabel(operation)}
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
        commissionMode={commissionMode}
        errors={deliveryErrors}
        isDelivering={isDelivering}
        onReceiverNameChange={(value) => {
          setReceiverName(value);
          setDeliveryErrors((current) => ({
            ...current,
            receiverName: undefined,
            operation: undefined,
          }));
        }}
        onCommissionModeChange={(value) => {
          setCommissionMode(value);
          setDeliveryErrors((current) => ({
            ...current,
            commissionMode: undefined,
            operation: undefined,
          }));
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
  commissionMode,
  errors,
  isDelivering,
  onReceiverNameChange,
  onCommissionModeChange,
  onClose,
  onConfirm,
}: {
  operation: Operation | null;
  receiverName: string;
  commissionMode: WithdrawalCommissionMode | "";
  errors: DeliveryErrors;
  isDelivering: boolean;
  onReceiverNameChange: (value: string) => void;
  onCommissionModeChange: (value: WithdrawalCommissionMode) => void;
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
              value={getPendingWithdrawalReasonLabel(operation)}
            />
            <ModalInfoItem
              label="Fecha de registro"
              value={formatDateTime(operation.createdAt)}
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
            aria-invalid={errors.receiverName ? true : undefined}
            aria-describedby={
              errors.receiverName
                ? "pending-delivery-receiver-error"
                : undefined
            }
          />
          {errors.receiverName && (
            <p
              id="pending-delivery-receiver-error"
              className="mt-2 text-sm font-medium text-red-600"
            >
              {errors.receiverName}
            </p>
          )}
        </div>

        <fieldset
          aria-invalid={errors.commissionMode ? true : undefined}
          aria-describedby={
            errors.commissionMode
              ? "pending-delivery-commission-mode-error"
              : undefined
          }
          data-validation-field="pendingDeliveryCommissionMode"
        >
          <legend className="mb-2 block text-sm font-semibold text-slate-700">
            Forma de cobrar la comision
            <span className="ml-1 text-red-500">*</span>
          </legend>
          <div className="grid gap-3 lg:grid-cols-3">
            {commissionModeOptions.map((option) => {
              const isSelected = commissionMode === option.value;
              return (
                <label
                  key={option.value}
                  className={`rounded-xl border p-4 text-sm transition ${
                    isSelected
                      ? "border-brand-primary bg-blue-50 text-slate-950"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="pending-delivery-commission-mode"
                    value={option.value}
                    checked={isSelected}
                    onChange={() => onCommissionModeChange(option.value)}
                    className="sr-only"
                  />
                  <span className="block font-semibold">{option.label}</span>
                  <span className="mt-1 block leading-5 text-slate-500">
                    {option.description}
                  </span>
                </label>
              );
            })}
          </div>
          {errors.commissionMode && (
            <p
              id="pending-delivery-commission-mode-error"
              className="mt-2 text-sm font-medium text-red-600"
            >
              {errors.commissionMode}
            </p>
          )}
        </fieldset>

        {errors.operation && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {errors.operation}
          </div>
        )}
      </div>
    </ModalShell>
  );
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
