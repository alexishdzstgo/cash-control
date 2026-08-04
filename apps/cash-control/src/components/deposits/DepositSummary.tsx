"use client";

import {
  CheckCircle2,
  Clock3,
} from "lucide-react";
import { NO_COMMISSION_RULE_MESSAGE } from "@/lib/commission";
import { formatCurrency } from "@/lib/formatters";
import { getBankLabel } from "@/config/banks";
import type {
  DepositFormData,
  DepositMode,
} from "@/types/deposit";

type DepositSummaryProps = {
  mode: DepositMode;
  formData: DepositFormData;
  amount: number;
  commission: number | null;
  hasCommissionRule: boolean;
  isReadyToRegister: boolean;
  onRegister: () => void;
};

const deliveryMethodLabels: Record<
  string,
  string
> = {
  "bank-transfer":
    "Transferencia bancaria",
  "cash-deposit": "Depósito en efectivo",
};

const pendingReasonLabels: Record<
  string,
  string
> = {
  "bank-unavailable":
    "Servicio bancario no disponible",
  "insufficient-bank-balance":
    "Saldo insuficiente en la cuenta",
  "movement-limit":
    "Límite de movimientos alcanzado",
  "customer-request":
    "Solicitud del cliente",
  other: "Otro motivo",
};

export function DepositSummary({
  mode,
  formData,
  amount,
  commission,
  hasCommissionRule,
  isReadyToRegister,
  onRegister,
}: DepositSummaryProps) {
  const isPendingMode = mode === "pending";

  /*
   * El cliente entrega el monto y además
   * paga la comisión.
   */
  const totalReceived = amount + (commission ?? 0);

  return (
    <aside className="sticky top-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Vista previa
        </p>

        <h2 className="mt-1 text-lg font-semibold text-slate-950">
          {isPendingMode
            ? "Resumen del depósito pendiente"
            : "Resumen del depósito"}
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Verifica la información antes de
          registrar la operación.
        </p>
      </div>

      <div className="p-6">
        <div className="space-y-4">
          <SummaryRow
            label="Folio bancario"
            value={
              formData.bankFolio ||
              "Sin capturar"
            }
            mono
          />

          <SummaryRow
            label="Banco de destino"
            value={getBankLabel(
              formData.destinationBank,
            )}
          />

          <SummaryRow
            label="Método de envío"
            value={
              deliveryMethodLabels[
                formData.deliveryMethod
              ] ?? "Sin seleccionar"
            }
          />

          <SummaryRow
            label="Entrega el efectivo"
            value={
              formData.senderName ||
              "Sin capturar"
            }
          />

          <SummaryRow
            label="Recibe el depósito"
            value={
              formData.receiverName ||
              "Sin capturar"
            }
          />

          <SummaryRow
            label="Referencia de destino"
            value={
              formData.destinationReference ||
              "Sin capturar"
            }
            mono
          />

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
                    formData.pendingReasonDetails ||
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
            label="Monto del depósito"
            value={formatCurrency(amount)}
          />

          <AmountRow
            label="Comisión"
            value={commission === null ? "Sin regla" : formatCurrency(commission)}
          />

          <div className="border-t border-slate-100 pt-4">
            <AmountRow
              label="Total recibido"
              value={formatCurrency(
                totalReceived,
              )}
              large
            />
          </div>
        </div>

        {!hasCommissionRule && amount > 0 && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            {NO_COMMISSION_RULE_MESSAGE}
          </div>
        )}

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
              Registrar depósito
            </>
          )}
        </button>

        <p className="mt-4 text-center text-sm leading-5 text-slate-500">
          {isPendingMode
            ? "La operación aparecerá en depósitos pendientes hasta que se complete."
            : "Después de registrar, la operación aparecerá en el historial."}
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
