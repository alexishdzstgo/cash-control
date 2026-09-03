"use client";

import { ArrowLeft, Clock3 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useBusinessFunds } from "@/components/business-funds/BusinessFundsContext";
import { useCommissionRules } from "@/components/commissions/CommissionRulesContext";
import { useReceiptPreferences } from "@/components/receipts/ReceiptPreferencesContext";
import { ReceiptPreviewDialog } from "@/components/receipts/ReceiptPreviewDialog";
import { useMockSession } from "@/components/session/MockSessionContext";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
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
import { normalizeWithdrawalBankReference } from "@/lib/finance";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { focusFirstInvalidField } from "@/lib/formValidationFocus";
import { getPendingWithdrawalReasonLabel } from "@/lib/pendingWithdrawalReasons";
import { buildReceiptData } from "@/lib/receipt";
import type { Operation } from "@/types/operation";
import {
  initialWithdrawalFormData,
  type WithdrawalCommissionMode,
  type WithdrawalFormData,
  type WithdrawalMode,
} from "@/types/withdrawal";
import { WithdrawalForm } from "./WithdrawalForm";
import { WithdrawalSummary } from "./WithdrawalSummary";

const withdrawalFieldOrder = [
  "bankFolio",
  "amount",
  "bank",
  "receiverName",
  "commissionMode",
  "pendingReason",
  "pendingReasonDetails",
] as const;

const SIMILAR_WITHDRAWAL_WINDOW_MS = 30 * 60 * 1000;

export function WithdrawalPage() {
  const router = useRouter();
  const { rules: commissionRules } = useCommissionRules();
  const { operations, registerClientOperation, resetVersion } =
    useBusinessFunds();
  const { authenticatedUser } = useMockSession();
  const { businessIdentity, preferences } = useReceiptPreferences();
  const [mode, setMode] = useState<WithdrawalMode>("delivered");
  const [successType, setSuccessType] = useState<WithdrawalMode>("delivered");
  const [formData, setFormData] = useState<WithdrawalFormData>(
    () => initialWithdrawalFormData,
  );
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [receiptOperation, setReceiptOperation] = useState<Operation | null>(
    null,
  );
  const [operationError, setOperationError] = useState<string | null>(null);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPendingConfirmationOpen, setIsPendingConfirmationOpen] =
    useState(false);
  const [exactDuplicate, setExactDuplicate] = useState<Operation | null>(null);
  const [similarWithdrawal, setSimilarWithdrawal] = useState<Operation | null>(
    null,
  );
  const submitLockRef = useRef(false);

  const isPendingMode = mode === "pending";
  const deliveredBy = authenticatedUser?.userName ?? "Usuario no disponible";
  const amountCents = parseCurrencyToCents(formData.amount) ?? 0;
  const amount = centsToPesos(amountCents);
  const commissionCalculation =
    amountCents > 0
      ? calculateCommission({
          amountCents,
          operationType: "retiro",
          rules: commissionRules,
        })
      : null;
  const commission =
    commissionCalculation === null
      ? null
      : centsToPesos(commissionCalculation.commissionAmountCents);
  const commissionAmount = commission ?? 0;
  const cashDeliveredToCustomer =
    formData.commissionMode === "deducted"
      ? Math.max(0, amount - commissionAmount)
      : amount;
  const validationErrors = showValidationErrors
    ? getWithdrawalValidationErrors({
        formData,
        amount,
        hasCommissionRule: commissionCalculation !== null,
        mode,
      })
    : {};

  useEffect(() => {
    if (resetVersion === 0) return;
    setFormData(initialWithdrawalFormData);
    setOperationError(null);
    setShowValidationErrors(false);
    setReceiptOperation(null);
    setIsPendingConfirmationOpen(false);
    setExactDuplicate(null);
    setSimilarWithdrawal(null);
    setIsSubmitting(false);
    submitLockRef.current = false;
  }, [resetVersion]);

  function resetForm() {
    setFormData(initialWithdrawalFormData);
    setOperationError(null);
    setShowValidationErrors(false);
  }

  function changeMode(nextMode: WithdrawalMode) {
    setMode(nextMode);
    resetForm();
    setExactDuplicate(null);
    setSimilarWithdrawal(null);
    setIsPendingConfirmationOpen(false);
  }

  function handleRegister({ skipSimilarityCheck = false } = {}) {
    if (submitLockRef.current) return;

    const errors = getWithdrawalValidationErrors({
      formData,
      amount,
      hasCommissionRule: isPendingMode || commissionCalculation !== null,
      mode,
    });

    if (Object.keys(errors).length > 0) {
      setShowValidationErrors(true);
      focusFirstInvalidField({
        errors,
        fieldOrder: withdrawalFieldOrder,
        fieldSelector: {
          bankFolio: "#withdrawal-bank-folio",
          amount: "#withdrawal-amount",
          bank: "#withdrawal-bank",
          receiverName: "#withdrawal-receiver",
          commissionMode: '[data-validation-field="commissionMode"]',
          pendingReason: "#withdrawal-pending-reason",
          pendingReasonDetails: "#withdrawal-pending-reason-details",
        },
      });
      return;
    }

    if (authenticatedUser === null) {
      setOperationError("Inicia sesión para registrar el retiro.");
      return;
    }

    if (
      (!isPendingMode && commissionCalculation === null) ||
      (!isPendingMode && !isWithdrawalCommissionMode(formData.commissionMode))
    ) {
      setOperationError(
        "No se pudo registrar el retiro. Revisa los datos e inténtalo nuevamente.",
      );
      return;
    }

    const duplicate = findExactWithdrawalDuplicate({
      operations,
      bankId: formData.bank,
      bankReference: formData.bankFolio,
    });
    if (duplicate) {
      setExactDuplicate(duplicate);
      return;
    }

    if (!skipSimilarityCheck) {
      const similar = findSimilarWithdrawal({
        operations,
        formData,
        amount,
      });
      if (similar) {
        setSimilarWithdrawal(similar);
        return;
      }
    }

    if (isPendingMode) {
      setIsPendingConfirmationOpen(true);
      return;
    }

    registerWithdrawal("entregado");
  }

  function registerWithdrawal(status: "entregado" | "pendiente") {
    if (submitLockRef.current) return;
    const isPendingRegistration = status === "pendiente";
    if (
      (!isPendingRegistration && commissionCalculation === null) ||
      (!isPendingRegistration &&
        !isWithdrawalCommissionMode(formData.commissionMode))
    ) {
      setOperationError(
        "No se pudo registrar el retiro. Revisa los datos e inténtalo nuevamente.",
      );
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    setOperationError(null);
    setExactDuplicate(null);
    setSimilarWithdrawal(null);

    const now = new Date().toISOString();
    const bankLabel = getBankLabel(formData.bank);
    const commissionMode =
      !isPendingRegistration &&
      isWithdrawalCommissionMode(formData.commissionMode)
        ? formData.commissionMode
        : undefined;
    const appliedCommission =
      isPendingRegistration || commissionCalculation === null
        ? 0
        : commissionAmount;
    const operationTotal =
      !isPendingRegistration && commissionMode === "deposited"
        ? amount + commissionAmount
        : amount;
    const operationCashDelivered =
      !isPendingRegistration && commissionMode === "deducted"
        ? Math.max(0, amount - commissionAmount)
        : amount;
    const operation: Operation = {
      id: `operation-withdrawal-${Date.now()}`,
      type: "retiro",
      status,
      bankFolio: formData.bankFolio.trim(),
      amount,
      commission: appliedCommission,
      total: operationTotal,
      appliedCommissionSnapshot:
        isPendingRegistration ||
        commissionCalculation === null ||
        !commissionMode
          ? undefined
          : {
              operationAmountCents: amountCents,
              calculatedCommissionCents:
                commissionCalculation.commissionAmountCents,
              finalCommissionCents: commissionCalculation.commissionAmountCents,
              ruleId: commissionCalculation.ruleId,
              ruleVersion: commissionCalculation.ruleVersion,
              calculationType: commissionCalculation.calculationType,
              location: commissionMode === "deposited" ? "bank" : "cash",
              appliedAt: now,
            },
      commissionLocation: isPendingRegistration
        ? "pending"
        : commissionMode === "deposited"
          ? "bank"
          : "cash",
      commissionStatus: isPendingRegistration ? "pending" : "realized",
      senderName: "",
      receiverName: status === "pendiente" ? "" : formData.receiverName.trim(),
      bankFrom: bankLabel,
      bankTo: "Caja fisica",
      bankResourceId: formData.bank,
      withdrawalCommissionMode: commissionMode,
      customerCashReceived: operationCashDelivered,
      bankMovementAmount: operationTotal,
      pendingReason:
        status === "pendiente" ? formData.pendingReason : undefined,
      pendingReasonDetails:
        status === "pendiente"
          ? formData.pendingReasonDetails.trim() || undefined
          : undefined,
      observations: formData.observations.trim() || undefined,
      createdAt: now,
      createdBy: deliveredBy,
      isEdited: false,
    };

    const result = registerClientOperation(operation);
    if (!result.success) {
      setOperationError(result.error ?? "No se pudo registrar el retiro.");
      submitLockRef.current = false;
      setIsSubmitting(false);
      return;
    }

    setSuccessType(status === "pendiente" ? "pending" : "delivered");
    setIsPendingConfirmationOpen(false);
    if (status === "entregado") {
      setReceiptOperation(operation);
    }
    setIsSuccessOpen(true);
    resetForm();
    submitLockRef.current = false;
    setIsSubmitting(false);
  }

  return (
    <>
      <div>
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <PageHeader
            title={isPendingMode ? "Nuevo retiro pendiente" : "Nuevo retiro"}
            description={
              isPendingMode
                ? "Registra un retiro cuyo efectivo todavía no ha sido entregado al cliente."
                : "Registra el deposito recibido en el banco del negocio y el efectivo entregado al cliente."
            }
          />

          {isPendingMode ? (
            <button
              type="button"
              onClick={() => changeMode("delivered")}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-100 hover:text-violet-800"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Volver a retiro normal
            </button>
          ) : (
            <button
              type="button"
              onClick={() => changeMode("pending")}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-100 hover:text-violet-800"
            >
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              Registrar retiro sin entregar
            </button>
          )}
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <WithdrawalForm
            mode={mode}
            formData={formData}
            errors={validationErrors}
            onFormDataChange={(nextFormData) => {
              setOperationError(null);
              setFormData(nextFormData);
            }}
          />

          <WithdrawalSummary
            mode={mode}
            formData={formData}
            deliveredBy={deliveredBy}
            amount={amount}
            commission={commission}
            cashDeliveredToCustomer={cashDeliveredToCustomer}
            hasCommissionRule={commissionCalculation !== null}
            isSubmitting={isSubmitting}
            errorMessage={operationError}
            onRegister={handleRegister}
          />
        </div>
      </div>

      <SuccessDialog
        isOpen={isSuccessOpen}
        title={
          successType === "pending"
            ? "Retiro pendiente registrado"
            : "Retiro registrado correctamente"
        }
        description={
          successType === "pending"
            ? "El retiro quedó pendiente de entrega y ya aparece en Retiros pendientes."
            : "El banco de recepcion, la caja y la comision se actualizaron con las reglas actuales."
        }
        buttonLabel={
          successType === "pending" ? "Registrar otro retiro" : "Ver ticket"
        }
        onClose={() => {
          setIsSuccessOpen(false);
          if (successType === "delivered") {
            setIsReceiptOpen(true);
          }
        }}
      />

      <ConfirmDialog
        isOpen={isPendingConfirmationOpen}
        title="Registrar retiro pendiente de entrega"
        description={`Se registrará ${formatCurrency(amount)} con referencia ${formData.bankFolio.trim()}. Todavía no se entregará efectivo y quedará visible en Retiros pendientes.`}
        confirmLabel="Registrar como pendiente"
        isConfirmDisabled={isSubmitting}
        onCancel={() => setIsPendingConfirmationOpen(false)}
        onConfirm={() => registerWithdrawal("pendiente")}
      />

      <ExactWithdrawalDuplicateDialog
        operation={exactDuplicate}
        onClose={() => setExactDuplicate(null)}
        onViewPending={() => {
          setExactDuplicate(null);
          router.push("/pending-withdrawals");
        }}
      />

      <SimilarWithdrawalDialog
        operation={similarWithdrawal}
        onClose={() => setSimilarWithdrawal(null)}
        onConfirm={() => {
          setSimilarWithdrawal(null);
          handleRegister({ skipSimilarityCheck: true });
        }}
        isSubmitting={isSubmitting}
      />

      <ReceiptPreviewDialog
        isOpen={isReceiptOpen}
        receiptData={
          receiptOperation
            ? buildReceiptData({
                operation: receiptOperation,
                deliveredBy,
              })
            : null
        }
        businessIdentity={businessIdentity}
        preferences={preferences}
        onClose={() => setIsReceiptOpen(false)}
      />
    </>
  );
}

function getWithdrawalValidationErrors({
  formData,
  amount,
  hasCommissionRule,
  mode,
}: {
  formData: WithdrawalFormData;
  amount: number;
  hasCommissionRule: boolean;
  mode: WithdrawalMode;
}): Partial<Record<keyof WithdrawalFormData, string>> {
  return {
    ...(formData.bankFolio.trim() === ""
      ? { bankFolio: "Ingresa el folio o referencia bancaria." }
      : {}),
    ...(amount <= 0 ? { amount: "Captura el monto a retirar." } : {}),
    ...(mode === "delivered" && !hasCommissionRule && amount > 0
      ? { amount: "No hay una regla de comision para este monto." }
      : {}),
    ...(formData.bank === ""
      ? { bank: "Selecciona el banco de recepcion." }
      : {}),
    ...(mode === "delivered" && formData.receiverName.trim() === ""
      ? { receiverName: "Captura el nombre de quien recibe." }
      : {}),
    ...(mode === "delivered" &&
    !isWithdrawalCommissionMode(formData.commissionMode)
      ? { commissionMode: "Selecciona cómo se cobrará la comisión." }
      : {}),
    ...(mode === "pending" && formData.pendingReason === ""
      ? { pendingReason: "Selecciona un motivo." }
      : {}),
    ...(mode === "pending" &&
    formData.pendingReason === "other" &&
    formData.pendingReasonDetails.trim() === ""
      ? { pendingReasonDetails: "Especifica el motivo." }
      : {}),
  };
}

function findExactWithdrawalDuplicate({
  operations,
  bankId,
  bankReference,
}: {
  operations: Operation[];
  bankId: string;
  bankReference: string;
}): Operation | null {
  const normalizedReference = normalizeWithdrawalBankReference(bankReference);
  if (!bankId || !normalizedReference) return null;

  // Exact protection: account + normalized reference blocks both delivered and
  // pending withdrawals. PostgreSQL should enforce this with a UNIQUE index.
  return (
    operations.find(
      (operation) =>
        operation.type === "retiro" &&
        operation.bankResourceId === bankId &&
        normalizeWithdrawalBankReference(operation.bankFolio) ===
          normalizedReference,
    ) ?? null
  );
}

function findSimilarWithdrawal({
  operations,
  formData,
  amount,
}: {
  operations: Operation[];
  formData: WithdrawalFormData;
  amount: number;
}): Operation | null {
  const now = Date.now();
  return (
    operations.find((operation) => {
      if (operation.type !== "retiro") return false;
      if (operation.bankResourceId !== formData.bank) return false;
      if (operation.amount !== amount) return false;

      const createdAt = new Date(operation.createdAt).getTime();
      if (Number.isNaN(createdAt)) return false;
      if (now - createdAt > SIMILAR_WITHDRAWAL_WINDOW_MS) return false;

      return true;
    }) ?? null
  );
}

function isWithdrawalCommissionMode(
  value: WithdrawalFormData["commissionMode"],
): value is WithdrawalCommissionMode {
  return value === "deposited" || value === "cash" || value === "deducted";
}

function ExactWithdrawalDuplicateDialog({
  operation,
  onClose,
  onViewPending,
}: {
  operation: Operation | null;
  onClose: () => void;
  onViewPending: () => void;
}) {
  if (!operation) return null;

  const isPending = operation.status === "pendiente";

  return (
    <ModalShell
      title={
        isPending
          ? "Este retiro ya está pendiente de entrega"
          : "Este retiro ya fue registrado"
      }
      description={
        isPending
          ? "Esta referencia bancaria ya corresponde a un retiro pendiente."
          : "Esta referencia bancaria ya corresponde a un retiro entregado."
      }
      onClose={onClose}
      maxWidth="lg"
      zIndex="high"
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {isPending ? "Cerrar" : "Entendido"}
          </button>
          {isPending && (
            <button
              type="button"
              className="btn-primary"
              onClick={onViewPending}
            >
              Ver retiro pendiente
            </button>
          )}
        </div>
      }
    >
      <ModalSection className="border-amber-200 bg-amber-50/40">
        <p className="text-sm font-semibold text-amber-900">
          Referencia {operation.bankFolio} en {operation.bankFrom}
        </p>
      </ModalSection>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <ModalInfoItem label="Folio/referencia" value={operation.bankFolio} />
        <ModalInfoItem
          label="Banco"
          value={operation.bankFrom ?? "Banco no disponible"}
        />
        <ModalInfoItem label="Monto" value={formatCurrency(operation.amount)} />
        <ModalInfoItem
          label={isPending ? "Fecha de registro" : "Fecha/hora"}
          value={formatDateTime(operation.createdAt)}
        />
        {operation.receiverName && (
          <ModalInfoItem
            label="Persona que recibió"
            value={operation.receiverName}
          />
        )}
        {isPending && (
          <ModalInfoItem
            label="Motivo de pendiente"
            value={getPendingWithdrawalReasonLabel(operation)}
          />
        )}
        <ModalInfoItem
          label="Usuario que registró"
          value={operation.createdBy || "Usuario no disponible"}
        />
        <ModalInfoItem
          label="Estado"
          value={isPending ? "Pendiente" : "Entregado"}
        />
      </div>
    </ModalShell>
  );
}

function SimilarWithdrawalDialog({
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
      title="Encontramos un retiro similar reciente"
      description="Revisa que la referencia bancaria esté escrita correctamente antes de continuar."
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
            Volver y revisar
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
          Hay otro retiro reciente con el mismo banco y monto.
        </p>
      </ModalSection>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <ModalInfoItem label="Monto" value={formatCurrency(operation.amount)} />
        <ModalInfoItem
          label="Banco"
          value={operation.bankFrom ?? "Banco no disponible"}
        />
        <ModalInfoItem label="Folio anterior" value={operation.bankFolio} />
        <ModalInfoItem
          label="Hora"
          value={formatDateTime(operation.createdAt)}
        />
        <ModalInfoItem
          label="Estado"
          value={operation.status === "pendiente" ? "Pendiente" : "Entregado"}
        />
      </div>
    </ModalShell>
  );
}
