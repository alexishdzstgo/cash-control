"use client";

import { useState } from "react";
import { useBusinessFunds } from "@/components/business-funds/BusinessFundsContext";
import { useCommissionRules } from "@/components/commissions/CommissionRulesContext";
import { ReceiptPreviewDialog } from "@/components/receipts/ReceiptPreviewDialog";
import { useReceiptPreferences } from "@/components/receipts/ReceiptPreferencesContext";
import { useMockSession } from "@/components/session/MockSessionContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { SuccessDialog } from "@/components/shared/SuccessDialog";
import { getBankLabel } from "@/config/banks";
import {
  calculateCommission,
  centsToPesos,
  parseCurrencyToCents,
} from "@/lib/commission";
import { buildReceiptData } from "@/lib/receipt";
import type { Operation } from "@/types/operation";
import {
  initialWithdrawalFormData,
  type WithdrawalCommissionMode,
  type WithdrawalFormData,
} from "@/types/withdrawal";
import { WithdrawalForm } from "./WithdrawalForm";
import { WithdrawalSummary } from "./WithdrawalSummary";

export function WithdrawalPage() {
  const { rules: commissionRules } = useCommissionRules();
  const { registerClientOperation } = useBusinessFunds();
  const { authenticatedUser } = useMockSession();
  const { businessIdentity, preferences } = useReceiptPreferences();
  const [formData, setFormData] = useState<WithdrawalFormData>(() =>
    initialWithdrawalFormData,
  );
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [receiptOperation, setReceiptOperation] = useState<Operation | null>(
    null,
  );
  const [operationError, setOperationError] = useState<string | null>(null);
  const [showValidationErrors, setShowValidationErrors] = useState(false);

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
  const hasCommissionMode = isWithdrawalCommissionMode(
    formData.commissionMode,
  );
  const bankMovementAmount =
    formData.commissionMode === "deposited"
      ? amount + commissionAmount
      : amount;
  const cashDeliveredToCustomer =
    formData.commissionMode === "deducted"
      ? Math.max(0, amount - commissionAmount)
      : amount;
  const isReadyToRegister =
    amount > 0 &&
    commissionCalculation !== null &&
    formData.bankFolio.trim() !== "" &&
    formData.bank !== "" &&
    formData.receiverName.trim() !== "" &&
    hasCommissionMode &&
    authenticatedUser !== null;
  const validationErrors = showValidationErrors
    ? getWithdrawalValidationErrors({
        formData,
        amount,
        hasCommissionRule: commissionCalculation !== null,
      })
    : {};

  function resetForm() {
    setFormData(initialWithdrawalFormData);
    setOperationError(null);
    setShowValidationErrors(false);
  }

  function handleRegister() {
    if (
      !isReadyToRegister ||
      commissionCalculation === null ||
      !isWithdrawalCommissionMode(formData.commissionMode)
    ) {
      setShowValidationErrors(true);
      return;
    }

    const now = new Date().toISOString();
    const bankLabel = getBankLabel(formData.bank);
    const commissionMode = formData.commissionMode;
    const operation: Operation = {
      id: `operation-withdrawal-${Date.now()}`,
      type: "retiro",
      status: "entregado",
      bankFolio: formData.bankFolio,
      amount,
      commission: commissionAmount,
      total: bankMovementAmount,
      appliedCommissionSnapshot: {
        operationAmountCents: amountCents,
        calculatedCommissionCents: commissionCalculation.commissionAmountCents,
        finalCommissionCents: commissionCalculation.commissionAmountCents,
        ruleId: commissionCalculation.ruleId,
        ruleVersion: commissionCalculation.ruleVersion,
        calculationType: commissionCalculation.calculationType,
        location: commissionMode === "deposited" ? "bank" : "cash",
        appliedAt: now,
      },
      commissionLocation:
        commissionMode === "deposited" ? "bank" : "cash",
      commissionStatus: "realized",
      senderName: formData.receiverName.trim(),
      receiverName: formData.receiverName.trim(),
      bankFrom: bankLabel,
      bankTo: "Caja fisica",
      bankResourceId: formData.bank,
      withdrawalCommissionMode: commissionMode,
      customerCashReceived: cashDeliveredToCustomer,
      bankMovementAmount,
      observations: formData.observations.trim() || undefined,
      createdAt: now,
      createdBy: deliveredBy,
      isEdited: false,
    };

    const result = registerClientOperation(operation);
    if (!result.success) {
      setOperationError(result.error ?? "No se pudo registrar el retiro.");
      return;
    }

    setReceiptOperation(operation);
    setIsSuccessOpen(true);
    resetForm();
  }

  return (
    <>
      <div>
        <PageHeader
          title="Nuevo retiro"
          description="Registra el deposito recibido en el banco del negocio y el efectivo entregado al cliente."
        />

        <div className="grid items-start gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <WithdrawalForm
            formData={formData}
            errors={validationErrors}
            onFormDataChange={(nextFormData) => {
              setOperationError(null);
              setFormData(nextFormData);
            }}
          />

          <WithdrawalSummary
            formData={formData}
            deliveredBy={deliveredBy}
            amount={amount}
            commission={commission}
            cashDeliveredToCustomer={cashDeliveredToCustomer}
            hasCommissionRule={commissionCalculation !== null}
            isReadyToRegister={isReadyToRegister}
            errorMessage={operationError}
            onRegister={handleRegister}
          />
        </div>
      </div>

      <SuccessDialog
        isOpen={isSuccessOpen}
        title="Retiro registrado correctamente"
        description="El banco de recepcion, la caja y la comision se actualizaron con las reglas actuales."
        buttonLabel="Ver ticket"
        onClose={() => {
          setIsSuccessOpen(false);
          setIsReceiptOpen(true);
        }}
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
}: {
  formData: WithdrawalFormData;
  amount: number;
  hasCommissionRule: boolean;
}): Partial<Record<keyof WithdrawalFormData, string>> {
  return {
    ...(formData.bankFolio.trim() === ""
      ? { bankFolio: "Captura el folio bancario." }
      : {}),
    ...(amount <= 0 ? { amount: "Captura el monto a retirar." } : {}),
    ...(!hasCommissionRule && amount > 0
      ? { amount: "No hay una regla de comision para este monto." }
      : {}),
    ...(formData.bank === ""
      ? { bank: "Selecciona el banco de recepcion." }
      : {}),
    ...(formData.receiverName.trim() === ""
      ? { receiverName: "Captura el nombre de quien recibe." }
      : {}),
    ...(!isWithdrawalCommissionMode(formData.commissionMode)
      ? { commissionMode: "Selecciona cómo se recibió la comisión." }
      : {}),
  };
}

function isWithdrawalCommissionMode(
  value: WithdrawalFormData["commissionMode"],
): value is WithdrawalCommissionMode {
  return value === "deposited" || value === "cash" || value === "deducted";
}
