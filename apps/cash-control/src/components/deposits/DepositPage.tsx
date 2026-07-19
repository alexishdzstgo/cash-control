"use client";

import {
  ArrowLeft,
  Clock3,
} from "lucide-react";
import { calculateCommission } from "@/lib/commission";
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

export function DepositPage() {
  const [mode, setMode] =
    useState<DepositMode>("completed");

  const [formData, setFormData] =
    useState<DepositFormData>(
      initialDepositFormData,
    );

  const [folioStatus, setFolioStatus] =
    useState<FolioStatus>("empty");

  const [
    isPendingConfirmationOpen,
    setIsPendingConfirmationOpen,
  ] = useState(false);

  const [isSuccessOpen, setIsSuccessOpen] =
    useState(false);

  const [successMode, setSuccessMode] =
    useState<DepositMode>("completed");

  const isPendingMode = mode === "pending";
  const amount = Number(formData.amount) || 0;

const commission = calculateCommission(amount);

  const hasRequiredCommonFields =
    folioStatus === "available" &&
    amount > 0 &&
    formData.senderName.trim() !== "" &&
    formData.receiverName.trim() !== "" &&
    formData.destinationBank !== "" &&
    formData.deliveryMethod !== "" &&
    formData.destinationReference.trim() !==
      "";

  const hasValidPendingReason =
    formData.pendingReason !== "" &&
    (formData.pendingReason !== "other" ||
      formData.pendingReasonDetails.trim() !==
        "");

  const isReadyToRegister = isPendingMode
    ? hasRequiredCommonFields &&
      hasValidPendingReason
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
      total: amount + commission,
      senderName: formData.senderName,
      receiverName: formData.receiverName,
      bankTo: formData.destinationBank,
      destinationReference:
        formData.destinationReference,
      deliveryMethod:
        formData.deliveryMethod,
      observations:
        formData.observations,
    };

    console.log(
      "Registrar depósito completado:",
      operation,
    );

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
      total: amount + commission,
      senderName: formData.senderName,
      receiverName: formData.receiverName,
      bankTo: formData.destinationBank,
      destinationReference:
        formData.destinationReference,
      deliveryMethod:
        formData.deliveryMethod,
      pendingReason:
        formData.pendingReason,
      pendingReasonDetails:
        formData.pendingReasonDetails,
      observations:
        formData.observations,
    };

    console.log(
      "Registrar depósito pendiente:",
      operation,
    );

    setIsPendingConfirmationOpen(false);
    setSuccessMode("pending");
    setIsSuccessOpen(true);
    resetForm();
  }

  return (
    <>
      <div>
        <div className="mb-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p
                className={`mb-1 text-sm font-medium ${
                  isPendingMode
                    ? "text-pending-text"
                    : "text-deposit-text"
                }`}
              >
                Depósitos
              </p>

              <h1 className="text-2xl font-bold text-slate-900">
                {isPendingMode
                  ? "Nuevo depósito pendiente"
                  : "Nuevo depósito"}
              </h1>

              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                {isPendingMode
                  ? "Registra el efectivo recibido cuando la operación bancaria todavía no puede completarse."
                  : "Registra el efectivo entregado por el cliente y el envío realizado a la cuenta de destino."}
              </p>
            </div>

            {isPendingMode ? (
              <button
                type="button"
                onClick={() =>
                  changeMode("completed")
                }
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-deposit-border hover:bg-deposit-soft hover:text-deposit-text"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver a depósito completado
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  changeMode("pending")
                }
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-pending-border bg-pending-soft px-4 py-2.5 text-sm font-semibold text-pending-text shadow-sm transition hover:bg-pending-ring"
              >
                <Clock3 className="h-4 w-4" />
                Registrar sin completar
              </button>
            )}
          </div>
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <DepositForm
            mode={mode}
            formData={formData}
            onFormDataChange={setFormData}
            onFolioStatusChange={
              setFolioStatus
            }
          />

          <DepositSummary
            mode={mode}
            formData={formData}
            amount={amount}
            commission={commission}
            isReadyToRegister={
              isReadyToRegister
            }
            onRegister={handleRegister}
          />
        </div>
      </div>

      <ConfirmDialog
        isOpen={
          isPendingConfirmationOpen
        }
        title="Registrar depósito pendiente"
        description={`El depósito con folio ${
          formData.bankFolio
        } por ${formatCurrency(
          amount,
        )} quedará pendiente de completar.`}
        confirmLabel="Registrar como pendiente"
        onCancel={() =>
          setIsPendingConfirmationOpen(
            false,
          )
        }
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
        onClose={() =>
          setIsSuccessOpen(false)
        }
      />
    </>
  );
}