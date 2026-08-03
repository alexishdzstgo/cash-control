"use client";

import { CheckCircle2, Clock3 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { getBankLabel } from "@/config/banks";
import type {
  WithdrawalFormData,
  WithdrawalMode,
} from "@/types/withdrawal";

interface WithdrawalSummaryProps {
  mode: WithdrawalMode;
  formData: WithdrawalFormData;
  amount: number;
  commission: number;
  isReadyToRegister: boolean;
  onRegister: () => void;
}

const pendingReasonLabels: Record<string, string> = {
  "bank-movement-limit":
    "Límite de movimientos visibles en la aplicación bancaria",
  "customer-not-present":
    "El cliente no se encuentra presente",
  other: "Otro motivo",
};

export function WithdrawalSummary({
  mode,
  formData,
  amount,
  commission,
  isReadyToRegister,
  onRegister,
}: WithdrawalSummaryProps) {
  const isPendingMode = mode === "pending";
  const total = amount + commission;

  return (
    <aside className="sticky top-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Vista previa
        </p>

        <h2 className="mt-1 text-lg font-semibold text-slate-950">
          {isPendingMode
            ? "Resumen del retiro pendiente"
            : "Resumen de entrega"}
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          {isPendingMode
            ? "Verifica los datos antes de registrar el retiro pendiente."
            : "Verifica los datos antes de entregar el efectivo."}
        </p>
      </div>

      <div className="p-6">
        <div className="space-y-4">
          <SummaryRow
            label="Folio bancario"
            value={formData.bankFolio || "Sin capturar"}
            mono
          />

          <SummaryRow
            label="Banco"
            value={getBankLabel(
              formData.bank,
            )}
          />

          <SummaryRow
            label="Nombre de quien envía"
            value={
              formData.senderName || "Sin capturar"
            }
          />

          {!isPendingMode && (
            <SummaryRow
              label="Nombre de quien recibe"
              value={
                formData.receiverName ||
                "Sin capturar"
              }
            />
          )}

          {isPendingMode && (
            <>
              <SummaryRow
                label="Motivo pendiente"
                value={
                  pendingReasonLabels[
                    formData.pendingReason
                  ] ?? "Sin seleccionar"
                }
              />

              {formData.pendingReason ===
                "other" && (
                <SummaryRow
                  label="Detalle del motivo"
                  value={
                    formData.pendingReasonDetails.trim() ||
                    "Sin especificar"
                  }
                />
              )}
            </>
          )}
        </div>

        <div className="my-6 border-t border-dashed border-slate-200" />

        <div className="space-y-4">
          <AmountRow
            label="Monto a entregar"
            value={formatCurrency(amount)}
          />

          <AmountRow
            label="Comisión"
            value={formatCurrency(commission)}
          />

          <div className="border-t border-slate-100 pt-4">
            <AmountRow
              label="Total de la operación"
              value={formatCurrency(total)}
              large
            />
          </div>
        </div>

        <button
          type="button"
          disabled={!isReadyToRegister}
          onClick={onRegister}
          className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-3 font-semibold text-white transition hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
        >
          {isPendingMode ? (
            <>
              <Clock3 className="h-5 w-5" />
              Registrar como pendiente
            </>
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5" />
              Registrar entrega
            </>
          )}
        </button>

        <p className="mt-4 text-center text-sm leading-5 text-slate-500">
          {isPendingMode
            ? "Aparecerá en retiros pendientes y se considerará durante el corte."
            : "Después de registrar, se podrá imprimir el ticket."}
        </p>
      </div>
    </aside>
  );
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

function AmountRow({
  label,
  value,
  large = false,
}: {
  label: string;
  value: string;
  large?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-slate-500">
        {label}
      </span>

      <span
        className={
          large
            ? "text-2xl font-bold text-slate-950 tabular-nums"
            : "font-semibold text-slate-950 tabular-nums"
        }
      >
        {value}
      </span>
    </div>
  );
}