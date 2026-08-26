"use client";

import { AmountField } from "@/components/shared/AmountField";
import { BankSelect } from "@/components/shared/BankSelect";
import { PersonNameField } from "@/components/shared/PersonNameField";
import { getValidationFieldProps } from "@/lib/formValidationFocus";
import type {
  WithdrawalCommissionMode,
  WithdrawalFormData,
  WithdrawalMode,
  WithdrawalPendingReason,
} from "@/types/withdrawal";

type WithdrawalFormProps = {
  mode: WithdrawalMode;
  formData: WithdrawalFormData;
  errors?: Partial<Record<keyof WithdrawalFormData, string>>;
  onFormDataChange: (data: WithdrawalFormData) => void;
};

const inputClass =
  "field-input px-4 py-3 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

const labelClass = "mb-2 block text-sm font-semibold text-slate-700";

const pendingReasonOptions: Array<{
  value: WithdrawalPendingReason;
  label: string;
}> = [
  { value: "customer_later", label: "Cliente recogerá después" },
  { value: "insufficient_cash", label: "Falta de efectivo disponible" },
  { value: "operational_limit", label: "Límite operativo" },
  { value: "other", label: "Otro" },
];

const commissionModeOptions: Array<{
  value: WithdrawalCommissionMode;
  label: string;
  description: string;
}> = [
  {
    value: "deposited",
    label: "Comision depositada por el cliente",
    description: "La comision se recibio en el banco de recepcion.",
  },
  {
    value: "cash",
    label: "Comision pagada en efectivo",
    description: "La comision se recibio en caja fisica.",
  },
  {
    value: "deducted",
    label: "Comision descontada del retiro",
    description: "La comision se descuenta del efectivo entregado.",
  },
];

export function WithdrawalForm({
  mode,
  formData,
  errors = {},
  onFormDataChange,
}: WithdrawalFormProps) {
  function updateField<Key extends keyof WithdrawalFormData>(
    field: Key,
    value: WithdrawalFormData[Key],
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
          Datos del retiro
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Captura el identificador bancario y los datos del retiro.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="withdrawal-bank-folio" className={labelClass}>
            Folio o referencia bancaria
            <span className="ml-1 text-red-500">*</span>
          </label>
          <input
            id="withdrawal-bank-folio"
            type="text"
            value={formData.bankFolio}
            onChange={(event) => updateField("bankFolio", event.target.value)}
            placeholder="Ej. ABC123"
            className={inputClass}
            aria-invalid={errors.bankFolio ? true : undefined}
            aria-describedby={
              errors.bankFolio ? "withdrawal-bank-folio-error" : undefined
            }
          />
          {errors.bankFolio && (
            <p
              id="withdrawal-bank-folio-error"
              className="mt-2 text-sm font-medium text-red-600"
            >
              {errors.bankFolio}
            </p>
          )}
          <p className="mt-2 text-xs text-slate-500">
            Ingresa el identificador generado por la aplicación bancaria.
          </p>
        </div>

        <AmountField
          id="withdrawal-amount"
          value={formData.amount}
          onChange={(value) => updateField("amount", value)}
          label="Monto a retirar"
          placeholder="0.00"
          required
          min={0}
          step={0.01}
          colorVariant="withdrawal"
          error={errors.amount}
        />

        <BankSelect
          id="withdrawal-bank"
          value={formData.bank}
          onChange={(value) => updateField("bank", value)}
          label="Banco de recepcion"
          colorVariant="withdrawal"
          required
          error={errors.bank}
        />

        <PersonNameField
          id="withdrawal-sender"
          value={formData.senderName}
          onChange={(value) => updateField("senderName", value)}
          label="Persona que envía"
          placeholder="Nombre completo"
          required
          colorVariant="withdrawal"
          error={errors.senderName}
        />

        {mode === "delivered" && (
          <PersonNameField
            id="withdrawal-receiver"
            value={formData.receiverName}
            onChange={(value) => updateField("receiverName", value)}
            label="Persona que recibe"
            placeholder="Nombre completo"
            required
            colorVariant="withdrawal"
            error={errors.receiverName}
          />
        )}

        <fieldset
          className="md:col-span-2"
          aria-invalid={errors.commissionMode ? true : undefined}
          aria-describedby={
            errors.commissionMode
              ? "withdrawal-commission-mode-error"
              : undefined
          }
          {...getValidationFieldProps("commissionMode")}
        >
          <legend className={labelClass}>
            Forma de cobrar la comision
            <span className="ml-1 text-red-500">*</span>
          </legend>
          <div className="grid gap-3 lg:grid-cols-3">
            {commissionModeOptions.map((option) => {
              const isSelected = formData.commissionMode === option.value;
              return (
                <label
                  key={option.value}
                  className={`rounded-xl border p-4 text-sm transition ${
                    isSelected
                      ? "border-brand-primary bg-blue-50 text-slate-950"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="withdrawal-commission-mode"
                    value={option.value}
                    checked={isSelected}
                    onChange={() => updateField("commissionMode", option.value)}
                    className="sr-only"
                  />
                  <span className="block font-semibold">{option.label}</span>
                  <span className="mt-1 block leading-5 text-slate-500">
                    {option.description}
                  </span>
                </label>
              );
            })}
          </div>
          {errors.commissionMode && (
            <p
              id="withdrawal-commission-mode-error"
              className="mt-2 text-sm font-medium text-red-600"
            >
              {errors.commissionMode}
            </p>
          )}
        </fieldset>

        {mode === "pending" && (
          <>
            <div>
              <label htmlFor="withdrawal-pending-reason" className={labelClass}>
                Motivo de pendiente
                <span className="ml-1 text-red-500">*</span>
              </label>
              <select
                id="withdrawal-pending-reason"
                value={formData.pendingReason}
                onChange={(event) =>
                  updateField(
                    "pendingReason",
                    event.target.value as WithdrawalPendingReason | "",
                  )
                }
                className={inputClass}
                aria-invalid={errors.pendingReason ? true : undefined}
                aria-describedby={
                  errors.pendingReason
                    ? "withdrawal-pending-reason-error"
                    : undefined
                }
              >
                <option value="">Selecciona un motivo</option>
                {pendingReasonOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errors.pendingReason && (
                <p
                  id="withdrawal-pending-reason-error"
                  className="mt-2 text-sm font-medium text-red-600"
                >
                  {errors.pendingReason}
                </p>
              )}
            </div>

            {formData.pendingReason === "other" && (
              <div>
                <label
                  htmlFor="withdrawal-pending-reason-details"
                  className={labelClass}
                >
                  Detalle del motivo
                  <span className="ml-1 text-red-500">*</span>
                </label>
                <input
                  id="withdrawal-pending-reason-details"
                  type="text"
                  value={formData.pendingReasonDetails}
                  onChange={(event) =>
                    updateField("pendingReasonDetails", event.target.value)
                  }
                  placeholder="Describe el motivo"
                  className={inputClass}
                  aria-invalid={errors.pendingReasonDetails ? true : undefined}
                  aria-describedby={
                    errors.pendingReasonDetails
                      ? "withdrawal-pending-reason-details-error"
                      : undefined
                  }
                />
                {errors.pendingReasonDetails && (
                  <p
                    id="withdrawal-pending-reason-details-error"
                    className="mt-2 text-sm font-medium text-red-600"
                  >
                    {errors.pendingReasonDetails}
                  </p>
                )}
              </div>
            )}
          </>
        )}

        <div className="md:col-span-2">
          <label htmlFor="withdrawal-observations" className={labelClass}>
            Observaciones
            <span className="ml-1 font-normal text-slate-400">(opcional)</span>
          </label>
          <textarea
            id="withdrawal-observations"
            rows={3}
            value={formData.observations}
            onChange={(event) =>
              updateField("observations", event.target.value)
            }
            placeholder="Agrega alguna nota interna"
            className={inputClass}
          />
        </div>
      </div>
    </section>
  );
}
