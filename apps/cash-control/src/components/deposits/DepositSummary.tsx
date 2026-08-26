"use client";

import { CheckCircle2 } from "lucide-react";
import { getBankLabel } from "@/config/banks";
import { NO_COMMISSION_RULE_MESSAGE } from "@/lib/commission";
import { formatCurrency } from "@/lib/formatters";
import type { DepositFormData } from "@/types/deposit";

type DepositSummaryProps = {
  formData: DepositFormData;
  receivedBy: string;
  amount: number;
  commission: number | null;
  hasCommissionRule: boolean;
  isReadyToRegister: boolean;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onRegister: () => void;
};

export function DepositSummary({
  formData,
  receivedBy,
  amount,
  commission,
  hasCommissionRule,
  isReadyToRegister,
  isSubmitting = false,
  errorMessage,
  onRegister,
}: DepositSummaryProps) {
  const totalReceived = amount + (commission ?? 0);

  return (
    <aside className="sticky top-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Vista previa
        </p>
        <h2 className="mt-1 text-lg font-semibold text-slate-950">
          Resumen del deposito
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Verifica cuanto efectivo debe recibir caja.
        </p>
      </div>

      <div className="p-6">
        <div className="space-y-4">
          <SummaryRow
            label="Folio del sistema"
            value={formData.bankFolio}
            mono
          />
          <SummaryRow label="Monto" value={formatCurrency(amount)} />
          <SummaryRow
            label="Destinatario"
            value={formData.receiverName || "Sin capturar"}
          />
          <SummaryRow
            label="Banco de emision"
            value={getBankLabel(formData.emissionBank)}
          />
          <SummaryRow
            label="Ultimos 4 digitos"
            value={formData.destinationAccountLast4 || "Sin capturar"}
            mono
          />
          <SummaryRow label="Recibio efectivo" value={receivedBy} />
          {formData.observations.trim() && (
            <SummaryRow
              label="Observaciones"
              value={formData.observations.trim()}
            />
          )}
        </div>

        <div className="my-6 border-t border-dashed border-slate-200" />

        <div className="space-y-4">
          <AmountRow
            label="Comision"
            value={
              commission === null ? "Sin regla" : formatCurrency(commission)
            }
          />
          <div className="border-t border-slate-100 pt-4">
            <AmountRow
              label="Total recibido"
              value={formatCurrency(totalReceived)}
              large
            />
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Caja fisica aumenta por {formatCurrency(totalReceived)} y el banco de
          emision disminuye por {formatCurrency(amount)}.
        </div>

        {!hasCommissionRule && amount > 0 && (
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
          aria-disabled={!isReadyToRegister || isSubmitting}
          disabled={isSubmitting}
          onClick={onRegister}
          className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold transition ${
            isReadyToRegister && !isSubmitting
              ? "bg-brand-primary text-white hover:bg-brand-primary-hover"
              : "cursor-not-allowed bg-slate-300 text-slate-600 hover:bg-slate-300"
          }`}
        >
          <CheckCircle2 className="h-5 w-5" />
          {isSubmitting ? "Registrando..." : "Registrar deposito"}
        </button>

        <p className="mt-4 text-center text-sm leading-5 text-slate-500">
          No se genera ticket: el cliente conserva el comprobante de la app
          bancaria.
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
      <span className="text-sm text-slate-500">{label}</span>
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
