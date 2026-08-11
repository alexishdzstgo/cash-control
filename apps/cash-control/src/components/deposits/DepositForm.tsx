"use client";

import { AmountField } from "@/components/shared/AmountField";
import { BankSelect } from "@/components/shared/BankSelect";
import { PersonNameField } from "@/components/shared/PersonNameField";
import type { DepositFormData } from "@/types/deposit";

type DepositFormProps = {
  formData: DepositFormData;
  errors?: Partial<Record<keyof DepositFormData, string>>;
  onFormDataChange: (formData: DepositFormData) => void;
};

const inputClass =
  "field-input px-4 py-3 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

const labelClass = "mb-2 block text-sm font-semibold text-slate-700";

export function DepositForm({
  formData,
  errors = {},
  onFormDataChange,
}: DepositFormProps) {
  function updateField<Key extends keyof DepositFormData>(
    field: Key,
    value: DepositFormData[Key],
  ) {
    onFormDataChange({
      ...formData,
      [field]: value,
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <p className="text-sm font-semibold text-slate-500">
          Informacion de la operacion
        </p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900">
          Datos del deposito
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Captura solo los datos necesarios para registrar el envio.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <AmountField
          id="deposit-amount"
          value={formData.amount}
          onChange={(value) => updateField("amount", value)}
          label="Monto a depositar"
          placeholder="0.00"
          min={0}
          step={0.01}
          required
          colorVariant="deposit"
          error={errors.amount}
        />

        <PersonNameField
          id="deposit-receiver"
          value={formData.receiverName}
          onChange={(value) => updateField("receiverName", value)}
          label="Nombre del destinatario"
          placeholder="Nombre completo"
          required
          colorVariant="deposit"
          error={errors.receiverName}
        />

        <BankSelect
          id="deposit-bank"
          value={formData.emissionBank}
          onChange={(value) => updateField("emissionBank", value)}
          label="Banco de emision"
          colorVariant="deposit"
          error={errors.emissionBank}
        />

        <div>
          <label htmlFor="deposit-account-last-4" className={labelClass}>
            Ultimos 4 digitos de la cuenta destino
            <span className="ml-1 text-red-500" aria-label="Campo obligatorio">
              *
            </span>
          </label>
          <input
            id="deposit-account-last-4"
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={formData.destinationAccountLast4}
            onChange={(event) =>
              updateField(
                "destinationAccountLast4",
                event.target.value.replace(/\D/g, "").slice(0, 4),
              )
            }
            placeholder="4821"
            className={inputClass}
            aria-invalid={errors.destinationAccountLast4 ? true : undefined}
            aria-describedby={
              errors.destinationAccountLast4
                ? "deposit-account-last-4-error"
                : undefined
            }
          />
          {errors.destinationAccountLast4 && (
            <p
              id="deposit-account-last-4-error"
              className="mt-2 text-sm font-medium text-red-600"
            >
              {errors.destinationAccountLast4}
            </p>
          )}
        </div>

        <div className="md:col-span-2">
          <label htmlFor="deposit-observations" className={labelClass}>
            Observaciones
            <span className="ml-1 font-normal text-slate-400">(opcional)</span>
          </label>
          <textarea
            id="deposit-observations"
            rows={3}
            value={formData.observations}
            onChange={(event) => updateField("observations", event.target.value)}
            placeholder="Agrega alguna nota interna"
            className={inputClass}
          />
        </div>
      </div>
    </section>
  );
}
