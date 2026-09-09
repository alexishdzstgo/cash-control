"use client";

import { useRef, useState } from "react";
import { useBusinessFunds } from "@/components/business-funds/BusinessFundsContext";
import { useCommissionRules } from "@/components/commissions/CommissionRulesContext";
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
    label: "Comisión depositada por el cliente",
    description: "La comisión se recibió en el banco de recepción.",
  },
  {
    value: "cash",
    label: "Comisión pagada en efectivo",
    description: "La comisión se recibió en caja física.",
  },
  {
    value: "deducted",
    label: "Comisión descontada del retiro",
    description: "La comisión se descuenta del efectivo entregado.",
  },
];

type DeliveryDialogProps = {
  operation: Operation | null;
  onClose: () => void;
  onDelivered?: (operation: Operation) => void;
};

export function PendingWithdrawalDeliveryDialog({
  operation,
  ...callbacks
}: DeliveryDialogProps) {
  return operation ? (
    <PendingWithdrawalDeliveryFlow
      key={operation.id}
      operation={operation}
      {...callbacks}
    />
  ) : null;
}

function PendingWithdrawalDeliveryFlow({
  operation: operationToDeliver,
  onClose,
  onDelivered,
}: Omit<DeliveryDialogProps, "operation"> & { operation: Operation }) {
  const { deliverPendingWithdrawal, canDeliverPendingWithdrawal } =
    useBusinessFunds();
  const { rules: commissionRules } = useCommissionRules();
  const busy = useRef(false);
  const [receiverName, setReceiverName] = useState("");
  const [commissionMode, setCommissionMode] = useState<
    WithdrawalCommissionMode | ""
  >("");
  const [deliveryErrors, setDeliveryErrors] = useState<DeliveryErrors>({});
  const [isDelivering, setIsDelivering] = useState(false);

  function confirmDelivery() {
    if (busy.current) return;

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
        operation: "No hay una regla de comisión para este monto.",
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

    busy.current = true;
    setIsDelivering(true);
    const result = deliverPendingWithdrawal({
      operationId: operationToDeliver.id,
      receiverName,
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
      busy.current = false;
      setIsDelivering(false);
      return;
    }

    if (result.operation) onDelivered?.(result.operation);
    onClose();
  }

  return (
    <ConfirmPendingWithdrawalDeliveryDialog
      operation={operationToDeliver}
      receiverName={receiverName}
      commissionMode={commissionMode}
      errors={deliveryErrors}
      isDelivering={isDelivering}
      canDeliver={canDeliverPendingWithdrawal()}
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
      onClose={() => {
        if (!busy.current) onClose();
      }}
      onConfirm={confirmDelivery}
    />
  );
}

function ConfirmPendingWithdrawalDeliveryDialog({
  operation,
  receiverName,
  commissionMode,
  errors,
  isDelivering,
  canDeliver,
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
  canDeliver: boolean;
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
            disabled={isDelivering || !canDeliver}
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
            Forma de cobrar la comisión
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
