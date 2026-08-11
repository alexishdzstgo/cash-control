"use client";

import { useState } from "react";
import { useCommissionRules } from "@/components/commissions/CommissionRulesContext";
import { useBusinessFunds } from "@/components/business-funds/BusinessFundsContext";
import { useMockSession } from "@/components/session/MockSessionContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { SuccessDialog } from "@/components/shared/SuccessDialog";
import { getBankLabel } from "@/config/banks";
import {
  calculateCommission,
  centsToPesos,
  parseCurrencyToCents,
} from "@/lib/commission";
import type { Operation } from "@/types/operation";
import { initialDepositFormData, type DepositFormData } from "@/types/deposit";
import { DepositForm } from "./DepositForm";
import { DepositSummary } from "./DepositSummary";

const FIRST_DEPOSIT_FOLIO = 1;

function buildDepositFolio(number: number): string {
  return `DEP-${number.toString().padStart(6, "0")}`;
}

function buildInitialForm(number: number): DepositFormData {
  return {
    ...initialDepositFormData,
    bankFolio: buildDepositFolio(number),
  };
}

export function DepositPage() {
  const { rules: commissionRules } = useCommissionRules();
  const { registerClientOperation } = useBusinessFunds();
  const { authenticatedUser } = useMockSession();
  const [nextFolioNumber, setNextFolioNumber] = useState(FIRST_DEPOSIT_FOLIO);
  const [formData, setFormData] = useState<DepositFormData>(() =>
    buildInitialForm(FIRST_DEPOSIT_FOLIO),
  );
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [showValidationErrors, setShowValidationErrors] = useState(false);

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

  const isAccountLast4Valid = /^\d{4}$/.test(
    formData.destinationAccountLast4,
  );
  const isReadyToRegister =
    amount > 0 &&
    commissionCalculation !== null &&
    formData.receiverName.trim() !== "" &&
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

  function resetForm() {
    setNextFolioNumber((current) => {
      const next = current + 1;
      setFormData(buildInitialForm(next));
      return next;
    });
    setOperationError(null);
    setShowValidationErrors(false);
  }

  function handleRegister() {
    if (!isReadyToRegister || commissionCalculation === null) {
      setShowValidationErrors(true);
      return;
    }

    const now = new Date().toISOString();
    const bankLabel = getBankLabel(formData.emissionBank);
    const commissionAmount = commission ?? 0;
    const operation: Operation = {
      id: `operation-deposit-${Date.now()}`,
      type: "deposito",
      status: "completado",
      bankFolio: formData.bankFolio,
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
      return;
    }

    setIsSuccessOpen(true);
    resetForm();
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
    ...(formData.receiverName.trim() === ""
      ? { receiverName: "Captura el nombre del destinatario." }
      : {}),
    ...(formData.emissionBank === ""
      ? { emissionBank: "Selecciona el banco de emision." }
      : {}),
    ...(!/^\d{4}$/.test(formData.destinationAccountLast4)
      ? {
          destinationAccountLast4:
            "Captura exactamente los ultimos 4 digitos.",
        }
      : {}),
  };
}
