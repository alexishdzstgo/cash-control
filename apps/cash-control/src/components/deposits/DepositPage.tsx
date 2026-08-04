"use client";

import { ArrowLeft, Clock3 } from "lucide-react";
import { useCommissionRules } from "@/components/commissions/CommissionRulesContext";
import {
  calculateCommission,
  centsToPesos,
  parseCurrencyToCents,
} from "@/lib/commission";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { SuccessDialog } from "@/components/shared/SuccessDialog";
import { formatCurrency } from "@/lib/formatters";
import {
  initialDepositFormData,
  type DepositFormData,
  type DepositMode,
} from "@/types/deposit";
import { DepositForm } from "./DepositForm";
import type { FolioStatus } from "@/types/folio";
import { DepositSummary } from "./DepositSummary";
import { PageHeader } from "@/components/shared/PageHeader";

export function DepositPage() {
  const { rules: commissionRules } = useCommissionRules();
  const [mode, setMode] = useState<DepositMode>("completed");

  const [formData, setFormData] = useState<DepositFormData>(
    initialDepositFormData,
  );

  const [folioStatus, setFolioStatus] = useState<FolioStatus>("empty");

  const [isPendingConfirmationOpen, setIsPendingConfirmationOpen] =
    useState(false);

  const [isSuccessOpen, setIsSuccessOpen] = useState(false);

  const [successMode, setSuccessMode] = useState<DepositMode>("completed");

  const isPendingMode = mode === "pending";
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

  const hasRequiredCommonFields =
    folioStatus === "available" &&
    amount > 0 &&
    commissionCalculation !== null &&
    formData.senderName.trim() !== "" &&
    formData.receiverName.trim() !== "" &&
    formData.destinationBank !== "" &&
    formData.deliveryMethod !== "" &&
    formData.destinationReference.trim() !== "";

  const hasValidPendingReason =
    formData.pendingReason !== "" &&
    (formData.pendingReason !== "other" ||
      formData.pendingReasonDetails.trim() !== "");

  const isReadyToRegister = isPendingMode
    ? hasRequiredCommonFields && hasValidPendingReason
    : hasRequiredCommonFields;

  function resetForm() {
    setFormData(initialDepositFormData);
    setFolioStatus("empty");
  }

  function changeMode(nextMode: DepositMode) {
    setMode(nextMode);
    resetForm();
  }

  function handleRegister() {
    if (!isReadyToRegister) {
      return;
    }

    if (isPendingMode) {
      setIsPendingConfirmationOpen(true);
      return;
    }

    const operation = {
      type: "deposito" as const,
      status: "completado" as const,
      bankFolio: formData.bankFolio,
      amount,
      commission,
      total: amount + (commission ?? 0),
      appliedCommissionSnapshot: commissionCalculation
        ? {
            operationAmountCents: amountCents,
            calculatedCommissionCents:
              commissionCalculation.commissionAmountCents,
            finalCommissionCents: commissionCalculation.commissionAmountCents,
            ruleId: commissionCalculation.ruleId,
            ruleVersion: commissionCalculation.ruleVersion,
            calculationType: commissionCalculation.calculationType,
            location: "cash" as const,
            appliedAt: new Date().toISOString(),
          }
        : undefined,
      commissionLocation: "cash" as const,
      commissionStatus: "realized" as const,
      senderName: formData.senderName,
      receiverName: formData.receiverName,
      bankTo: formData.destinationBank,
      destinationReference: formData.destinationReference,
      deliveryMethod: formData.deliveryMethod,
      observations: formData.observations,
    };

    console.log("Registrar depósito completado:", operation);

    setSuccessMode("completed");
    setIsSuccessOpen(true);
    resetForm();
  }

  function confirmPendingDeposit() {
    const operation = {
      type: "deposito" as const,
      status: "pendiente" as const,
      bankFolio: formData.bankFolio,
      amount,
      commission,
      total: amount + (commission ?? 0),
      appliedCommissionSnapshot: commissionCalculation
        ? {
            operationAmountCents: amountCents,
            calculatedCommissionCents:
              commissionCalculation.commissionAmountCents,
            finalCommissionCents: commissionCalculation.commissionAmountCents,
            ruleId: commissionCalculation.ruleId,
            ruleVersion: commissionCalculation.ruleVersion,
            calculationType: commissionCalculation.calculationType,
            location: "cash" as const,
            appliedAt: new Date().toISOString(),
          }
        : undefined,
      commissionLocation: "cash" as const,
      commissionStatus: "reserved" as const,
      senderName: formData.senderName,
      receiverName: formData.receiverName,
      bankTo: formData.destinationBank,
      destinationReference: formData.destinationReference,
      deliveryMethod: formData.deliveryMethod,
      pendingReason: formData.pendingReason,
      pendingReasonDetails: formData.pendingReasonDetails,
      observations: formData.observations,
    };

    console.log("Registrar depósito pendiente:", operation);

    setIsPendingConfirmationOpen(false);
    setSuccessMode("pending");
    setIsSuccessOpen(true);
    resetForm();
  }

  return (
    <>
      <div>
        <PageHeader
          title={
            isPendingMode
              ? "Nuevo depósito pendiente"
              : "Nuevo depósito"
          }
          description={
            isPendingMode
              ? "Registra el efectivo recibido cuando la operación bancaria todavía no puede completarse."
              : "Registra el efectivo entregado por el cliente y el envío realizado a la cuenta de destino."
          }
          action={
            isPendingMode ? (
              <button
                type="button"
                onClick={() => changeMode("completed")}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Volver a depósito completado
              </button>
            ) : (
              <button
                type="button"
                onClick={() => changeMode("pending")}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 shadow-sm transition hover:border-amber-300 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2"
              >
                <Clock3 className="h-4 w-4" aria-hidden="true" />
                Registrar sin completar
              </button>
            )
          }
        />

        <div className="grid items-start gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <DepositForm
            mode={mode}
            formData={formData}
            onFormDataChange={setFormData}
            onFolioStatusChange={setFolioStatus}
          />

          <DepositSummary
            mode={mode}
            formData={formData}
            amount={amount}
            commission={commission}
            hasCommissionRule={commissionCalculation !== null}
            isReadyToRegister={isReadyToRegister}
            onRegister={handleRegister}
          />
        </div>
      </div>

      <ConfirmDialog
        isOpen={isPendingConfirmationOpen}
        title="Registrar depósito pendiente"
        description={`El depósito con folio ${formData.bankFolio} por ${formatCurrency(amount)} quedará pendiente de completar.`}
        confirmLabel="Registrar como pendiente"
        onCancel={() => setIsPendingConfirmationOpen(false)}
        onConfirm={confirmPendingDeposit}
      />

      <SuccessDialog
        isOpen={isSuccessOpen}
        title={
          successMode === "pending"
            ? "Depósito pendiente registrado"
            : "Depósito registrado correctamente"
        }
        description={
          successMode === "pending"
            ? "La operación quedó pendiente y podrá completarse posteriormente."
            : "El depósito fue registrado correctamente y aparecerá en el historial."
        }
        buttonLabel="Registrar otro depósito"
        onClose={() => setIsSuccessOpen(false)}
      />
    </>
  );
}
