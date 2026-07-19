"use client";

import { AmountField } from "@/components/shared/AmountField";
import { BankSelect } from "@/components/shared/BankSelect";
import { FolioField } from "@/components/shared/FolioField";
import { PersonNameField } from "@/components/shared/PersonNameField";
import { SelectField } from "@/components/shared/SelectField";
import { getFolioStatus } from "@/lib/folio";
import type { FolioStatus } from "@/types/folio";
import type {
  WithdrawalFormData,
  WithdrawalMode,
} from "@/types/withdrawal";

interface WithdrawalFormProps {
  mode: WithdrawalMode;
  formData: WithdrawalFormData;
  onFormDataChange: (data: WithdrawalFormData) => void;
  onFolioStatusChange: (status: FolioStatus) => void;
}

export function WithdrawalForm({
  mode,
  formData,
  onFormDataChange,
  onFolioStatusChange,
}: WithdrawalFormProps) {
  const isPendingMode = mode === "pending";

  const isFormEnabled =
    getFolioStatus(formData.bankFolio) === "available";

  function updateField<K extends keyof WithdrawalFormData>(
    field: K,
    value: WithdrawalFormData[K],
  ) {
    onFormDataChange({
      ...formData,
      [field]: value,
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-950">
          {isPendingMode
            ? "Datos del retiro pendiente"
            : "Datos del retiro"}
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          {isPendingMode
            ? "Captura la información del retiro cuyo efectivo todavía no será entregado."
            : "Primero captura el folio bancario para verificar que el movimiento no haya sido registrado."}
        </p>
      </div>

      <form className="space-y-6">
        <FolioField
          id="withdrawal-bank-folio"
          value={formData.bankFolio}
          onChange={(value) => updateField("bankFolio", value)}
          onStatusChange={onFolioStatusChange}
          label="Folio bancario"
          placeholder="Ej. 837291045"
          colorVariant="withdrawal"
          showStatusMessages
        />

        <AmountField
          id="withdrawal-amount"
          value={formData.amount}
          onChange={(value) => updateField("amount", value)}
          label="Monto a entregar"
          placeholder="$0.00"
          required
          disabled={!isFormEnabled}
          min={0}
          step={0.01}
          colorVariant="withdrawal"
        />

        <BankSelect
          id="withdrawal-bank"
          value={formData.bank}
          onChange={(value) => updateField("bank", value)}
          label="Banco de origen"
          colorVariant="withdrawal"
          disabled={!isFormEnabled}
        />

        <PersonNameField
          id="withdrawal-sender"
          value={formData.senderName}
          onChange={(value) =>
            updateField("senderName", value)
          }
          label="Nombre de quien envía"
          placeholder="Nombre completo"
          disabled={!isFormEnabled}
          required
          colorVariant="withdrawal"
        />

        {!isPendingMode && (
          <PersonNameField
            id="withdrawal-receiver"
            value={formData.receiverName}
            onChange={(value) =>
              updateField("receiverName", value)
            }
            label="Nombre de quien recibe"
            placeholder="Nombre completo"
            disabled={!isFormEnabled}
            required
            colorVariant="withdrawal"
          />
        )}

        {isPendingMode && (
          <>
            <Field
              label="Motivo del retiro pendiente"
              required
              help="Indica por qué el efectivo todavía no ha sido entregado."
            >
              <SelectField
                value={formData.pendingReason}
                onChange={(value) => {
                  onFormDataChange({
                    ...formData,
                    pendingReason: value,
                    pendingReasonDetails:
                      value === "other"
                        ? formData.pendingReasonDetails
                        : "",
                  });
                }}
                disabled={!isFormEnabled}
                options={[
                  {
                    value: "bank-movement-limit",
                    label:
                      "Límite de movimientos visibles en la aplicación bancaria",
                  },
                  {
                    value: "customer-not-present",
                    label: "El cliente no se encuentra presente",
                  },
                  {
                    value: "other",
                    label: "Otro motivo",
                  },
                ]}
              />
            </Field>

            {formData.pendingReason === "other" && (
              <Field
                label="Especifica el motivo"
                required
                help="Describe brevemente por qué el retiro quedará pendiente."
              >
                <textarea
                  className={`${inputClass} min-h-24 resize-none`}
                  placeholder="Escribe el motivo"
                  disabled={!isFormEnabled}
                  value={formData.pendingReasonDetails}
                  onChange={(event) =>
                    updateField(
                      "pendingReasonDetails",
                      event.target.value,
                    )
                  }
                />
              </Field>
            )}
          </>
        )}

        <Field label="Observaciones">
          <textarea
            className={`${inputClass} min-h-28 resize-none`}
            placeholder="Opcional. No aparecerá en el ticket."
            disabled={!isFormEnabled}
            value={formData.observations}
            onChange={(event) =>
              updateField("observations", event.target.value)
            }
          />
        </Field>
      </form>
    </section>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 font-sans text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-withdrawal-400 focus:bg-white focus:ring-4 focus:ring-withdrawal-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400";

function Field({
  label,
  help,
  required = false,
  children,
}: {
  label: string;
  help?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-base font-semibold text-slate-800">
        {label}

        {required && (
          <span
            className="ml-1 text-red-500"
            aria-label="Campo obligatorio"
          >
            *
          </span>
        )}
      </label>

      <div className="mt-2">{children}</div>

      {help && (
        <p className="mt-2 text-sm text-slate-500">
          {help}
        </p>
      )}
    </div>
  );
}