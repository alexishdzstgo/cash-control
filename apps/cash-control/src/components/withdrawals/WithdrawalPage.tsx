"use client";

import { ArrowLeft, Clock3 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { SuccessDialog } from "@/components/shared/SuccessDialog";
import { formatCurrency } from "@/lib/formatters";
import {
  initialWithdrawalFormData,
  type WithdrawalFormData,
  type WithdrawalMode,
} from "@/types/withdrawal";
import { WithdrawalForm } from "./WithdrawalForm";
import type { FolioStatus } from "@/types/folio";
import { WithdrawalSummary } from "./WithdrawalSummary";
import { calculateCommission } from "@/lib/commission";
import { PageHeader } from "@/components/shared/PageHeader";

export function WithdrawalPage() {
  const [mode, setMode] = useState<WithdrawalMode>("delivered");

  const [formData, setFormData] = useState<WithdrawalFormData>(
    initialWithdrawalFormData,
  );

  const [folioStatus, setFolioStatus] = useState<FolioStatus>("empty");

  const [isPendingConfirmationOpen, setIsPendingConfirmationOpen] =
    useState(false);

  const [isSuccessOpen, setIsSuccessOpen] = useState(false);

  const [successType, setSuccessType] = useState<WithdrawalMode>("delivered");

  const isPendingMode = mode === "pending";
  const amount = Number(formData.amount) || 0;

  const commission = calculateCommission(amount);

  const hasRequiredCommonFields =
    folioStatus === "available" &&
    amount > 0 &&
    formData.senderName.trim() !== "" &&
    formData.bank !== "";

  const hasRequiredDeliveryFields =
    formData.receiverName.trim() !== "";

  const hasValidPendingReason =
    formData.pendingReason !== "" &&
    (formData.pendingReason !== "other" ||
      formData.pendingReasonDetails.trim() !== "");

  const isReadyToRegister = isPendingMode
    ? hasRequiredCommonFields && hasValidPendingReason
    : hasRequiredCommonFields && hasRequiredDeliveryFields;

  function resetForm() {
    setFormData(initialWithdrawalFormData);
    setFolioStatus("empty");
  }

  function changeMode(nextMode: WithdrawalMode) {
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
      ...formData,
      amount,
      commission,
      total: amount + commission,
      type: "retiro" as const,
      status: "entregado" as const,
    };

    console.log("Registrar retiro entregado:", operation);

    setSuccessType("delivered");
    setIsSuccessOpen(true);
    resetForm();
  }

  function confirmPendingWithdrawal() {
    const operation = {
      ...formData,
      receiverName: "",
      amount,
      commission,
      total: amount + commission,
      type: "retiro" as const,
      status: "pendiente" as const,
    };

    console.log("Registrar retiro pendiente:", operation);

    setIsPendingConfirmationOpen(false);
    setSuccessType("pending");
    setIsSuccessOpen(true);
    resetForm();
  }

  return (
    <>
      <div>
        <PageHeader
          title={
            isPendingMode
              ? "Nuevo retiro pendiente"
              : "Nuevo retiro"
          }
          description={
            isPendingMode
              ? "Registra un retiro cuyo efectivo todavía no ha sido entregado al cliente."
              : "Registra la entrega de efectivo correspondiente a un movimiento validado en la aplicación bancaria."
          }
          action={
            isPendingMode ? (
              <button
                type="button"
                onClick={() => changeMode("delivered")}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Volver a registrar entrega
              </button>
            ) : (
              <button
                type="button"
                onClick={() => changeMode("pending")}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 shadow-sm transition hover:border-amber-300 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2"
              >
                <Clock3 className="h-4 w-4" aria-hidden="true" />
                Registrar retiro sin entregar
              </button>
            )
          }
        />

        <div className="grid items-start gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <WithdrawalForm
            mode={mode}
            formData={formData}
            onFormDataChange={setFormData}
            onFolioStatusChange={setFolioStatus}
          />

          <WithdrawalSummary
            mode={mode}
            formData={formData}
            amount={amount}
            commission={commission}
            isReadyToRegister={isReadyToRegister}
            onRegister={handleRegister}
          />
        </div>
      </div>

      <ConfirmDialog
        isOpen={isPendingConfirmationOpen}
        title="Registrar retiro pendiente de entrega"
        description={`El retiro con folio ${formData.bankFolio} y monto de ${formatCurrency(amount)} quedará pendiente de entrega. Aparecerá en retiros pendientes y se considerará durante el corte.`}
        confirmLabel="Registrar como pendiente"
        onCancel={() => setIsPendingConfirmationOpen(false)}
        onConfirm={confirmPendingWithdrawal}
      />

      <SuccessDialog
        isOpen={isSuccessOpen}
        title={
          successType === "pending"
            ? "Retiro pendiente registrado"
            : "Retiro entregado correctamente"
        }
        description={
          successType === "pending"
            ? "El retiro quedó registrado como pendiente de entrega y se incluirá en el corte."
            : "La entrega de efectivo fue registrada correctamente."
        }
        buttonLabel="Registrar otro retiro"
        onClose={() => setIsSuccessOpen(false)}
      />
    </>
  );
}