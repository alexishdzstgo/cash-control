"use client";

import { CheckCircle2 } from "lucide-react";
import { getBankLabel } from "@/config/banks";
import { NO_COMMISSION_RULE_MESSAGE } from "@/lib/commission";
import { formatCurrency } from "@/lib/formatters";
import type {
  WithdrawalCommissionMode,
  WithdrawalFormData,
  WithdrawalMode,
} from "@/types/withdrawal";

type WithdrawalSummaryProps = {
  mode: WithdrawalMode;
  formData: WithdrawalFormData;
  deliveredBy: string;
  amount: number;
  commission: number | null;
  cashDeliveredToCustomer: number;
  hasCommissionRule: boolean;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onRegister: () => void;
};

const commissionModeLabels: Record<WithdrawalCommissionMode, string> = {
  deposited: "Comision depositada por el cliente",
  cash: "Comision pagada en efectivo",
  deducted: "Comision descontada del retiro",
};

const commissionDestinationLabels: Record<WithdrawalCommissionMode, string> = {
  deposited: "Banco de recepcion",
  cash: "Caja fisica",
  deducted: "Caja fisica",
};

const pendingReasonLabels: Record<string, string> = {
  visible_movement_limit: "Límite de movimientos visibles en la app bancaria",
  other: "Otro",
};

export function WithdrawalSummary({
  mode,
  formData,
  deliveredBy,
  amount,
  commission,
  cashDeliveredToCustomer,
  hasCommissionRule,
  isSubmitting = false,
  errorMessage,
  onRegister,
}: WithdrawalSummaryProps) {
  const isPendingMode = mode === "pending";
  const selectedCommissionMode = isWithdrawalCommissionMode(
    formData.commissionMode,
  )
    ? formData.commissionMode
    : null;
  const commissionModeLabel = selectedCommissionMode
    ? commissionModeLabels[selectedCommissionMode]
    : "Sin seleccionar";
  const commissionDestinationLabel = selectedCommissionMode
    ? commissionDestinationLabels[selectedCommissionMode]
    : "Sin seleccionar";

  return (
    <aside className="sticky top-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Vista previa
        </p>
        <h2 className="mt-1 text-lg font-semibold text-slate-950">
          Resumen del retiro
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {isPendingMode
            ? "Verifica los datos antes de apartar el efectivo."
            : "Verifica los datos antes de entregar el efectivo."}
        </p>
      </div>

      <div className="p-6">
        <div className="space-y-4">
          <SummaryRow
            label="Folio o referencia bancaria"
            value={formData.bankFolio || "Sin capturar"}
            mono
          />
          <SummaryRow label="Monto" value={formatCurrency(amount)} />
          <SummaryRow
            label="Banco de recepcion"
            value={getBankLabel(formData.bank)}
          />
          {!isPendingMode && (
            <SummaryRow
              label="Nombre de quien recibe"
              value={formData.receiverName || "Sin capturar"}
            />
          )}
          {!isPendingMode && (
            <>
              <SummaryRow
                label="Forma de cobrar comision"
                value={commissionModeLabel}
              />
              <SummaryRow
                label="Comision"
                value={
                  commission === null ? "Sin regla" : formatCurrency(commission)
                }
              />
              <SummaryRow label="Entrega el efectivo" value={deliveredBy} />
            </>
          )}
          <SummaryRow
            label={
              isPendingMode
                ? "Efectivo que quedará apartado"
                : "Efectivo que recibira el cliente"
            }
            value={formatCurrency(cashDeliveredToCustomer)}
          />
          {!isPendingMode && (
            <SummaryRow
              label="Destino de la comision"
              value={commissionDestinationLabel}
            />
          )}
          {isPendingMode && formData.pendingReason && (
            <SummaryRow
              label="Motivo de pendiente"
              value={
                formData.pendingReason === "other"
                  ? formData.pendingReasonDetails || "Sin capturar"
                  : (pendingReasonLabels[formData.pendingReason] ??
                    formData.pendingReason)
              }
            />
          )}
          {formData.observations.trim() && (
            <SummaryRow
              label="Observaciones"
              value={formData.observations.trim()}
            />
          )}
        </div>

        {!isPendingMode && !hasCommissionRule && amount > 0 && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            {NO_COMMISSION_RULE_MESSAGE}
          </div>
        )}

        {errorMessage && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {errorMessage}
          </div>
        )}

        <button
          type="button"
          aria-disabled={isSubmitting}
          disabled={isSubmitting}
          onClick={onRegister}
          className="btn-primary mt-8 w-full px-4 py-3"
        >
          <CheckCircle2 className="h-5 w-5" />
          {isSubmitting
            ? "Registrando..."
            : isPendingMode
              ? "Registrar como pendiente"
              : "Registrar retiro y generar ticket"}
        </button>

        <p className="mt-4 text-center text-sm leading-5 text-slate-500">
          {isPendingMode
            ? "Quedará visible en Retiros pendientes."
            : "Despues de registrar, podras revisar e imprimir el comprobante."}
        </p>
      </div>
    </aside>
  );
}

function isWithdrawalCommissionMode(
  value: WithdrawalFormData["commissionMode"],
): value is WithdrawalCommissionMode {
  return value === "deposited" || value === "cash" || value === "deducted";
}

function SummaryRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p
        className={`mt-1 break-words text-sm font-semibold text-slate-800 ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
