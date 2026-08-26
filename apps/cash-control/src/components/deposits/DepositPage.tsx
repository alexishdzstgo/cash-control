"use client";

import { useEffect, useRef, useState } from "react";
import { useBusinessFunds } from "@/components/business-funds/BusinessFundsContext";
import { useCommissionRules } from "@/components/commissions/CommissionRulesContext";
import { useMockSession } from "@/components/session/MockSessionContext";
import {
  ModalInfoItem,
  ModalSection,
  ModalShell,
} from "@/components/shared/ModalShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { SuccessDialog } from "@/components/shared/SuccessDialog";
import { getBankLabel } from "@/config/banks";
import {
  calculateCommission,
  centsToPesos,
  parseCurrencyToCents,
} from "@/lib/commission";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { focusFirstInvalidField } from "@/lib/formValidationFocus";
import { type DepositFormData, initialDepositFormData } from "@/types/deposit";
import type { Operation } from "@/types/operation";
import { DepositForm } from "./DepositForm";
import { DepositSummary } from "./DepositSummary";

const DUPLICATE_DEPOSIT_WINDOW_MS = 10 * 60 * 1000;
const depositFieldOrder = [
  "amount",
  "emissionBank",
  "destinationAccountLast4",
] as const;

function buildDepositFolio(consecutive: number): string {
  return `DEP-${consecutive.toString().padStart(6, "0")}`;
}

function getDepositFolioConsecutive(folio: string): number | null {
  const match = /^DEP-(\d+)$/.exec(folio);
  if (!match) return null;

  return Number(match[1]);
}

function getNextDepositFolio(operations: Operation[]): string {
  // Prototype-only: in PostgreSQL this consecutive must be generated atomically
  // and protected by backend idempotency/uniqueness, not by frontend state.
  const maxConsecutive = operations
    .filter((operation) => operation.type === "deposito")
    .reduce((max, operation) => {
      const consecutive = getDepositFolioConsecutive(operation.bankFolio);
      return consecutive === null ? max : Math.max(max, consecutive);
    }, 0);

  return buildDepositFolio(maxConsecutive + 1);
}

function buildInitialForm(operations: Operation[]): DepositFormData {
  return {
    ...initialDepositFormData,
    bankFolio: getNextDepositFolio(operations),
  };
}

export function DepositPage() {
  const { rules: commissionRules } = useCommissionRules();
  const { operations, registerClientOperation, resetVersion } =
    useBusinessFunds();
  const { authenticatedUser } = useMockSession();
  const [formData, setFormData] = useState<DepositFormData>(() =>
    buildInitialForm(operations),
  );
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [possibleDuplicate, setPossibleDuplicate] = useState<Operation | null>(
    null,
  );
  const submitLockRef = useRef(false);

  const receivedBy = authenticatedUser?.userName ?? "Usuario no disponible";
  const amountCents = parseCurrencyToCents(formData.amount) ?? 0;
  const amount = centsToPesos(amountCents);
  const commissionCalculation =
    amountCents > 0
      ? calculateCommission({
          amountCents,
          operationType: "deposito",
          rules: commissionRules,
        })
      : null;
  const commission =
    commissionCalculation === null
      ? null
      : centsToPesos(commissionCalculation.commissionAmountCents);

  const isAccountLast4Valid = /^\d{4}$/.test(formData.destinationAccountLast4);
  const isReadyToRegister =
    amount > 0 &&
    commissionCalculation !== null &&
    formData.emissionBank !== "" &&
    isAccountLast4Valid &&
    authenticatedUser !== null;
  const validationErrors = showValidationErrors
    ? getDepositValidationErrors({
        formData,
        amount,
        hasCommissionRule: commissionCalculation !== null,
      })
    : {};

  useEffect(() => {
    if (resetVersion === 0) return;
    setFormData(buildInitialForm([]));
    setOperationError(null);
    setShowValidationErrors(false);
    setPossibleDuplicate(null);
    setIsSubmitting(false);
    submitLockRef.current = false;
  }, [resetVersion]);

  function resetForm(nextOperations: Operation[]) {
    setFormData(buildInitialForm(nextOperations));
    setOperationError(null);
    setShowValidationErrors(false);
  }

  function handleRegister() {
    registerDeposit();
  }

  function registerDeposit({ skipDuplicateCheck = false } = {}) {
    if (submitLockRef.current) return;

    if (!isReadyToRegister || commissionCalculation === null) {
      const errors = getDepositValidationErrors({
        formData,
        amount,
        hasCommissionRule: commissionCalculation !== null,
      });
      setShowValidationErrors(true);
      focusFirstInvalidField({
        errors,
        fieldOrder: depositFieldOrder,
        fieldSelector: {
          amount: "#deposit-amount",
          emissionBank: "#deposit-bank",
          destinationAccountLast4: "#deposit-account-last-4",
        },
      });
      return;
    }

    const duplicate = skipDuplicateCheck
      ? null
      : findPossibleDuplicateDeposit({
          operations,
          formData,
          amount,
        });

    if (duplicate) {
      setPossibleDuplicate(duplicate);
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    setPossibleDuplicate(null);

    const now = new Date().toISOString();
    const bankLabel = getBankLabel(formData.emissionBank);
    const commissionAmount = commission ?? 0;
    const generatedFolio = getNextDepositFolio(operations);
    const operation: Operation = {
      id: `operation-deposit-${Date.now()}`,
      type: "deposito",
      status: "completado",
      bankFolio: generatedFolio,
      amount,
      commission: commissionAmount,
      total: amount + commissionAmount,
      appliedCommissionSnapshot: {
        operationAmountCents: amountCents,
        calculatedCommissionCents: commissionCalculation.commissionAmountCents,
        finalCommissionCents: commissionCalculation.commissionAmountCents,
        ruleId: commissionCalculation.ruleId,
        ruleVersion: commissionCalculation.ruleVersion,
        calculationType: commissionCalculation.calculationType,
        location: "cash",
        appliedAt: now,
      },
      commissionLocation: "cash",
      commissionStatus: "realized",
      senderName: "Cliente en efectivo",
      receiverName: formData.receiverName.trim(),
      bankFrom: "Caja fisica",
      bankTo: bankLabel,
      bankResourceId: formData.emissionBank,
      destinationReference: `**** ${formData.destinationAccountLast4}`,
      destinationAccountLast4: formData.destinationAccountLast4,
      observations: formData.observations.trim() || undefined,
      createdAt: now,
      createdBy: receivedBy,
      isEdited: false,
    };

    const result = registerClientOperation(operation);
    if (!result.success) {
      setOperationError(result.error ?? "No se pudo registrar el deposito.");
      submitLockRef.current = false;
      setIsSubmitting(false);
      return;
    }

    setIsSuccessOpen(true);
    resetForm([operation, ...operations]);
    submitLockRef.current = false;
    setIsSubmitting(false);
  }

  return (
    <>
      <div>
        <PageHeader
          title="Nuevo deposito"
          description="Registra el efectivo recibido del cliente y el banco desde donde se enviara el dinero."
        />

        <div className="grid items-start gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <DepositForm
            formData={formData}
            errors={validationErrors}
            onFormDataChange={(nextFormData) => {
              setOperationError(null);
              setFormData(nextFormData);
            }}
          />

          <DepositSummary
            formData={formData}
            receivedBy={receivedBy}
            amount={amount}
            commission={commission}
            hasCommissionRule={commissionCalculation !== null}
            isReadyToRegister={isReadyToRegister}
            isSubmitting={isSubmitting}
            errorMessage={operationError}
            onRegister={handleRegister}
          />
        </div>
      </div>

      <SuccessDialog
        isOpen={isSuccessOpen}
        title="Deposito registrado correctamente"
        description="La caja y el banco de emision se actualizaron con las reglas actuales de comision."
        buttonLabel="Registrar otro deposito"
        onClose={() => setIsSuccessOpen(false)}
      />

      <PossibleDuplicateDepositDialog
        operation={possibleDuplicate}
        onClose={() => setPossibleDuplicate(null)}
        onConfirm={() => registerDeposit({ skipDuplicateCheck: true })}
        isSubmitting={isSubmitting}
      />
    </>
  );
}

function getDepositValidationErrors({
  formData,
  amount,
  hasCommissionRule,
}: {
  formData: DepositFormData;
  amount: number;
  hasCommissionRule: boolean;
}): Partial<Record<keyof DepositFormData, string>> {
  return {
    ...(amount <= 0 ? { amount: "Captura el monto a depositar." } : {}),
    ...(!hasCommissionRule && amount > 0
      ? { amount: "No hay una regla de comision para este monto." }
      : {}),
    ...(formData.emissionBank === ""
      ? { emissionBank: "Selecciona un banco de emisión." }
      : {}),
    ...(!/^\d{4}$/.test(formData.destinationAccountLast4)
      ? {
          destinationAccountLast4: "Captura exactamente los ultimos 4 digitos.",
        }
      : {}),
  };
}

function findPossibleDuplicateDeposit({
  operations,
  formData,
  amount,
}: {
  operations: Operation[];
  formData: DepositFormData;
  amount: number;
}): Operation | null {
  // Heuristic warning only: bank + amount + last4 + time window is not a future
  // UNIQUE constraint because legitimate equal deposits can happen minutes apart.
  const now = Date.now();
  const normalizedReceiverName = formData.receiverName.trim().toLowerCase();

  return (
    operations.find((operation) => {
      if (operation.type !== "deposito") return false;
      if (operation.bankResourceId !== formData.emissionBank) return false;
      if (operation.amount !== amount) return false;
      if (
        operation.destinationAccountLast4 !== formData.destinationAccountLast4
      ) {
        return false;
      }

      const createdAt = new Date(operation.createdAt).getTime();
      if (Number.isNaN(createdAt)) return false;
      if (now - createdAt > DUPLICATE_DEPOSIT_WINDOW_MS) return false;

      const previousReceiverName = operation.receiverName.trim().toLowerCase();
      return (
        normalizedReceiverName === "" ||
        previousReceiverName === "" ||
        previousReceiverName === normalizedReceiverName
      );
    }) ?? null
  );
}

function PossibleDuplicateDepositDialog({
  operation,
  onClose,
  onConfirm,
  isSubmitting,
}: {
  operation: Operation | null;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}) {
  if (!operation) return null;

  return (
    <ModalShell
      title="Posible depósito duplicado"
      description="Ya existe un depósito reciente con datos similares. Revisa la información antes de continuar."
      onClose={onClose}
      maxWidth="lg"
      zIndex="high"
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Registrando..." : "Registrar de todos modos"}
          </button>
        </div>
      }
    >
      <ModalSection className="border-amber-200 bg-amber-50/40">
        <p className="text-sm font-semibold text-amber-900">
          Se encontró un depósito similar: {operation.bankFolio}.
        </p>
      </ModalSection>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <ModalInfoItem label="Monto" value={formatCurrency(operation.amount)} />
        <ModalInfoItem
          label="Banco de emisión"
          value={operation.bankTo ?? "Banco no disponible"}
        />
        <ModalInfoItem
          label="Cuenta destino"
          value={`•••• ${operation.destinationAccountLast4 ?? "----"}`}
        />
        <ModalInfoItem
          label="Registro anterior"
          value={formatDateTime(operation.createdAt)}
        />
        {operation.receiverName && (
          <ModalInfoItem label="Destinatario" value={operation.receiverName} />
        )}
        <ModalInfoItem
          label="Registró"
          value={operation.createdBy || "Usuario no disponible"}
        />
      </div>
    </ModalShell>
  );
}
