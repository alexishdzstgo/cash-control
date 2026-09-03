"use client";

import { useEffect, useMemo, useState } from "react";
import { useCommissionRules } from "@/components/commissions/CommissionRulesContext";
import { AmountField } from "@/components/shared/AmountField";
import { BankSelect } from "@/components/shared/BankSelect";
import {
  ModalInfoItem,
  ModalSection,
  ModalShell,
} from "@/components/shared/ModalShell";
import { getBankLabel } from "@/config/banks";
import {
  calculateCommission,
  centsToPesos,
  parseCurrencyToCents,
} from "@/lib/commission";
import { normalizeWithdrawalBankReference } from "@/lib/finance";
import { formatCurrency } from "@/lib/formatters";
import { focusFirstInvalidField } from "@/lib/formValidationFocus";
import type { Operation } from "@/types/operation";

const correctionReasons = [
  "Monto capturado incorrectamente",
  "Banco seleccionado incorrectamente",
  "Referencia capturada incorrectamente",
  "Datos del cliente incorrectos",
  "Más de un dato incorrecto",
  "Otro",
] as const;

const withdrawalCommissionModeLabels = {
  deposited: "Comisión depositada por el cliente",
  cash: "Comisión pagada en efectivo",
  deducted: "Comisión descontada del retiro",
} as const;

type CorrectionField =
  | "bankFolio"
  | "amount"
  | "bankResourceId"
  | "destinationAccountLast4"
  | "receiverName"
  | "reason"
  | "reasonDetails";

type CorrectionErrors = Partial<Record<CorrectionField, string>>;

type ChangePreview = {
  label: string;
  before: string;
  after: string;
};

type OperationCorrectionModalProps = {
  operation: Operation | null;
  error: string | null;
  isSaving: boolean;
  onClose: () => void;
  onConfirm: (input: {
    amount: number;
    bankResourceId: string;
    bankFolio?: string;
    destinationAccountLast4?: string;
    receiverName?: string;
    reason: string;
    reasonDetails?: string;
  }) => void;
};

const inputClass = "field-input px-4 py-3";
const labelClass = "mb-2 block text-sm font-semibold text-slate-700";

export function OperationCorrectionModal({
  operation,
  error,
  isSaving,
  onClose,
  onConfirm,
}: OperationCorrectionModalProps) {
  const { rules } = useCommissionRules();
  const [amount, setAmount] = useState("");
  const [bankResourceId, setBankResourceId] = useState("");
  const [bankFolio, setBankFolio] = useState("");
  const [destinationAccountLast4, setDestinationAccountLast4] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [reason, setReason] = useState("");
  const [reasonDetails, setReasonDetails] = useState("");
  const [errors, setErrors] = useState<CorrectionErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!operation) return;

    setAmount(operation.amount.toFixed(2));
    setBankResourceId(operation.bankResourceId ?? "");
    setBankFolio(operation.bankFolio);
    setDestinationAccountLast4(operation.destinationAccountLast4 ?? "");
    setReceiverName(operation.receiverName);
    setReason("");
    setReasonDetails("");
    setErrors({});
    setFormError(null);
  }, [operation]);

  const amountValue = centsToPesos(parseCurrencyToCents(amount) ?? 0);
  const commissionPreview = useMemo(() => {
    if (!operation || operation.status === "pendiente" || amountValue <= 0) {
      return null;
    }

    return calculateCommission({
      amountCents: parseCurrencyToCents(amount) ?? 0,
      operationType: operation.type,
      rules,
      effectiveAt: operation.createdAt,
    });
  }, [amount, amountValue, operation, rules]);

  if (!operation) return null;

  const currentOperation = operation;
  const isDeposit = currentOperation.type === "deposito";
  const isPendingWithdrawal =
    currentOperation.type === "retiro" &&
    currentOperation.status === "pendiente";
  const fieldOrder: CorrectionField[] = isDeposit
    ? ["amount", "bankResourceId", "destinationAccountLast4", "reason"]
    : currentOperation.status === "entregado"
      ? ["bankFolio", "amount", "bankResourceId", "receiverName", "reason"]
      : ["bankFolio", "amount", "bankResourceId", "reason"];
  const changePreview = getChangePreview({
    operation: currentOperation,
    amount: amountValue,
    bankResourceId,
    bankFolio,
    destinationAccountLast4,
    receiverName,
    nextCommission:
      commissionPreview === null
        ? currentOperation.commission
        : centsToPesos(commissionPreview.commissionAmountCents),
  });

  function validate(): boolean {
    const nextErrors: CorrectionErrors = {};
    if (currentOperation.type === "retiro" && !bankFolio.trim()) {
      nextErrors.bankFolio = "Captura el folio o referencia bancaria.";
    }
    if (amountValue <= 0) {
      nextErrors.amount = "Captura un monto válido.";
    }
    if (!bankResourceId) {
      nextErrors.bankResourceId = isDeposit
        ? "Selecciona el banco de emisión."
        : "Selecciona el banco receptor.";
    }
    if (isDeposit && !/^\d{4}$/.test(destinationAccountLast4)) {
      nextErrors.destinationAccountLast4 =
        "Captura exactamente los últimos 4 dígitos.";
    }
    if (
      currentOperation.type === "retiro" &&
      currentOperation.status === "entregado" &&
      !receiverName.trim()
    ) {
      nextErrors.receiverName = "Captura el nombre de quien recibe.";
    }
    if (!reason) {
      nextErrors.reason = "Selecciona el motivo de corrección.";
    }
    if (reason === "Otro" && !reasonDetails.trim()) {
      nextErrors.reasonDetails = "Describe el motivo.";
    }

    if (Object.keys(nextErrors).length === 0 && changePreview.length === 0) {
      setFormError("No realizaste ningún cambio en la operación.");
      return false;
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setFormError("Revisa los campos obligatorios.");
      focusFirstInvalidField({
        errors: nextErrors,
        fieldOrder:
          reason === "Otro" ? [...fieldOrder, "reasonDetails"] : fieldOrder,
        fieldSelector: {
          bankFolio: "#operation-correction-bank-folio",
          amount: "#operation-correction-amount",
          bankResourceId: "#operation-correction-bank",
          destinationAccountLast4: "#operation-correction-last4",
          receiverName: "#operation-correction-receiver",
          reason: "#operation-correction-reason",
          reasonDetails: "#operation-correction-reason-details",
        },
      });
      return false;
    }

    setErrors({});
    setFormError(null);
    return true;
  }

  function submit() {
    if (!validate()) return;

    onConfirm({
      amount: amountValue,
      bankResourceId,
      bankFolio:
        currentOperation.type === "retiro"
          ? normalizeWithdrawalBankReference(bankFolio)
          : undefined,
      destinationAccountLast4: isDeposit ? destinationAccountLast4 : undefined,
      receiverName:
        isDeposit || currentOperation.status === "entregado"
          ? receiverName
          : undefined,
      reason,
      reasonDetails,
    });
  }

  return (
    <ModalShell
      title="Corregir operación"
      description="Corrige un dato capturado incorrectamente. Los cambios quedarán registrados en Auditoría."
      onClose={onClose}
      maxWidth="xl"
      zIndex="high"
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={submit}
            disabled={isSaving}
          >
            {isSaving ? "Guardando..." : "Guardar corrección"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <ModalSection className="border-amber-200 bg-amber-50/50">
          <p className="text-sm font-semibold text-amber-900">
            Esta corrección puede actualizar los saldos del negocio. Los datos
            anteriores no se eliminarán.
          </p>
        </ModalSection>

        <ModalSection>
          <div className="grid gap-3 md:grid-cols-3">
            <ModalInfoItem label="Folio actual" value={operation.bankFolio} />
            <ModalInfoItem label="Tipo" value={operation.type} />
            <ModalInfoItem
              label="Monto actual"
              value={formatCurrency(operation.amount)}
            />
          </div>
        </ModalSection>

        <div className="grid gap-5 md:grid-cols-2">
          {operation.type === "retiro" && (
            <TextField
              id="operation-correction-bank-folio"
              label="Folio/referencia"
              value={bankFolio}
              onChange={(value) => {
                setBankFolio(value);
                clearError("bankFolio");
              }}
              error={errors.bankFolio}
              required
            />
          )}

          <AmountField
            id="operation-correction-amount"
            label="Monto"
            value={amount}
            onChange={(value) => {
              setAmount(value);
              clearError("amount");
            }}
            required
            error={errors.amount}
          />

          <BankSelect
            id="operation-correction-bank"
            label={isDeposit ? "Banco de emisión" : "Banco receptor"}
            value={bankResourceId}
            onChange={(value) => {
              setBankResourceId(value);
              clearError("bankResourceId");
            }}
            required
            error={errors.bankResourceId}
          />

          {isDeposit && (
            <>
              <TextField
                id="operation-correction-last4"
                label="Últimos 4 dígitos"
                value={destinationAccountLast4}
                onChange={(value) => {
                  setDestinationAccountLast4(
                    value.replace(/\D/g, "").slice(0, 4),
                  );
                  clearError("destinationAccountLast4");
                }}
                error={errors.destinationAccountLast4}
                required
                inputMode="numeric"
                maxLength={4}
              />
              <TextField
                id="operation-correction-receiver"
                label="Destinatario"
                value={receiverName}
                onChange={setReceiverName}
              />
            </>
          )}

          {operation.type === "retiro" && operation.status === "entregado" && (
            <TextField
              id="operation-correction-receiver"
              label="Nombre de quien recibe"
              value={receiverName}
              onChange={(value) => {
                setReceiverName(value);
                clearError("receiverName");
              }}
              error={errors.receiverName}
              required
            />
          )}
        </div>

        {operation.type === "retiro" && operation.status === "entregado" && (
          <ModalSection>
            <div className="grid gap-3 md:grid-cols-3">
              <ModalInfoItem
                label="Forma de comisión"
                value={
                  operation.withdrawalCommissionMode
                    ? withdrawalCommissionModeLabels[
                        operation.withdrawalCommissionMode
                      ]
                    : "No disponible"
                }
              />
              <ModalInfoItem
                label="Comisión actual"
                value={formatCurrency(operation.commission)}
              />
              <ModalInfoItem
                label="Comisión resultante"
                value={
                  commissionPreview
                    ? formatCurrency(
                        centsToPesos(commissionPreview.commissionAmountCents),
                      )
                    : "Sin regla disponible"
                }
              />
            </div>
          </ModalSection>
        )}

        {isPendingWithdrawal && (
          <ModalSection className="border-violet-200 bg-violet-50/70">
            <p className="text-sm font-semibold text-violet-900">
              Este retiro todavía no ha sido entregado. La reserva de efectivo
              se actualizará automáticamente.
            </p>
          </ModalSection>
        )}

        <div>
          <label htmlFor="operation-correction-reason" className={labelClass}>
            Motivo de corrección
            <span className="ml-1 text-red-500">*</span>
          </label>
          <select
            id="operation-correction-reason"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              clearError("reason");
            }}
            className={inputClass}
            aria-invalid={errors.reason ? true : undefined}
            aria-describedby={
              errors.reason ? "operation-correction-reason-error" : undefined
            }
          >
            <option value="">Selecciona un motivo</option>
            {correctionReasons.map((reasonOption) => (
              <option key={reasonOption} value={reasonOption}>
                {reasonOption}
              </option>
            ))}
          </select>
          {errors.reason && (
            <p
              id="operation-correction-reason-error"
              className="mt-2 text-sm font-medium text-red-600"
            >
              {errors.reason}
            </p>
          )}
        </div>

        {reason === "Otro" && (
          <div>
            <label
              htmlFor="operation-correction-reason-details"
              className={labelClass}
            >
              Describe el motivo
              <span className="ml-1 text-red-500">*</span>
            </label>
            <textarea
              id="operation-correction-reason-details"
              value={reasonDetails}
              onChange={(event) => {
                setReasonDetails(event.target.value);
                clearError("reasonDetails");
              }}
              className="field-input min-h-28 px-4 py-3"
              aria-invalid={errors.reasonDetails ? true : undefined}
              aria-describedby={
                errors.reasonDetails
                  ? "operation-correction-reason-details-error"
                  : undefined
              }
            />
            {errors.reasonDetails && (
              <p
                id="operation-correction-reason-details-error"
                className="mt-2 text-sm font-medium text-red-600"
              >
                {errors.reasonDetails}
              </p>
            )}
          </div>
        )}

        {changePreview.length > 0 && (
          <ModalSection>
            <h3 className="mb-4 text-sm font-bold text-slate-900">
              Cambios detectados
            </h3>
            <div className="space-y-3">
              {changePreview.map((change) => (
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

        {(formError || error) && (
          <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {formError ?? error}
          </p>
        )}
      </div>
    </ModalShell>
  );

  function clearError(field: CorrectionField) {
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  }
}

function TextField({
  id,
  label,
  value,
  onChange,
  error,
  required = false,
  inputMode,
  maxLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  inputMode?: "text" | "numeric";
  maxLength?: number;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <input
        id={id}
        type="text"
        inputMode={inputMode}
        maxLength={maxLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p id={`${id}-error`} className="mt-2 text-sm font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function getChangePreview({
  operation,
  amount,
  bankResourceId,
  bankFolio,
  destinationAccountLast4,
  receiverName,
  nextCommission,
}: {
  operation: Operation;
  amount: number;
  bankResourceId: string;
  bankFolio: string;
  destinationAccountLast4: string;
  receiverName: string;
  nextCommission: number;
}): ChangePreview[] {
  const changes: ChangePreview[] = [];

  addChange(changes, "Monto", operation.amount, amount, formatCurrency);
  addChange(
    changes,
    "Banco",
    operation.bankResourceId ?? "",
    bankResourceId,
    getBankLabel,
  );
  addChange(
    changes,
    "Comisión",
    operation.commission,
    nextCommission,
    formatCurrency,
  );

  if (operation.type === "deposito") {
    addChange(
      changes,
      "Últimos 4 dígitos",
      operation.destinationAccountLast4 ?? "",
      destinationAccountLast4,
    );
    addChange(changes, "Destinatario", operation.receiverName, receiverName);
    return changes;
  }

  addChange(
    changes,
    "Folio/referencia",
    operation.bankFolio,
    normalizeWithdrawalBankReference(bankFolio),
  );

  if (operation.status === "entregado") {
    addChange(
      changes,
      "Nombre de quien recibe",
      operation.receiverName,
      receiverName,
    );
  }

  return changes;
}

function addChange<T>(
  changes: ChangePreview[],
  label: string,
  beforeValue: T,
  afterValue: T,
  formatValue: (value: T) => string = String,
) {
  if (beforeValue === afterValue) return;

  changes.push({
    label,
    before: formatValue(beforeValue),
    after: formatValue(afterValue),
  });
}
