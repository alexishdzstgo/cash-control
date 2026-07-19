"use client";

import { useEffect, useRef } from "react";
import { SelectField } from "@/components/shared/SelectField";
import type {
  WithdrawalFormData,
  WithdrawalMode,
} from "@/types/withdrawal";

export type FolioStatus = "empty" | "duplicate" | "available";

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
  const folioInputRef = useRef<HTMLInputElement>(null);
  const isPendingMode = mode === "pending";

  useEffect(() => {
    folioInputRef.current?.focus();
  }, []);

  const folioStatus: FolioStatus =
    formData.bankFolio.trim() === ""
      ? "empty"
      : formData.bankFolio.trim() === "12345"
        ? "duplicate"
        : "available";

  useEffect(() => {
    onFolioStatusChange(folioStatus);
  }, [folioStatus, onFolioStatusChange]);

  const isFormEnabled = folioStatus === "available";

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
        <Field label="Folio bancario" required>
          <input
            ref={folioInputRef}
            className={inputClass}
            placeholder="Ej. 837291045"
            value={formData.bankFolio}
            onChange={(event) =>
              updateField("bankFolio", event.target.value)
            }
          />

          {folioStatus === "empty" && (
            <p className="mt-2 text-sm text-slate-500">
              Captura el folio para habilitar el resto del formulario.
            </p>
          )}

          {folioStatus === "available" && (
            <p className="mt-2 text-sm font-medium text-emerald-600">
              Folio disponible. Puedes continuar con la captura.
            </p>
          )}

          {folioStatus === "duplicate" && (
            <p className="mt-2 text-sm font-medium text-red-600">
              Este folio ya fue registrado anteriormente. No se puede continuar.
            </p>
          )}
        </Field>

        <Field label="Monto a entregar" required>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            className={inputClass}
            placeholder="$0.00"
            disabled={!isFormEnabled}
            value={formData.amount}
            onChange={(event) =>
              updateField("amount", event.target.value)
            }
          />
        </Field>

        <Field label="Banco donde se recibió el dinero" required>
          <SelectField
            value={formData.bank}
            onChange={(value) => updateField("bank", value)}
            disabled={!isFormEnabled}
            options={[
              {
                value: "banco-azteca",
                label: "Banco Azteca",
              },
              {
                value: "bbva",
                label: "BBVA",
              },
              {
                value: "banamex",
                label: "Banamex",
              },
            ]}
          />
        </Field>

        <Field label="Nombre de quien envía" required>
          <input
            className={inputClass}
            placeholder="Nombre completo"
            disabled={!isFormEnabled}
            value={formData.senderName}
            onChange={(event) =>
              updateField("senderName", event.target.value)
            }
          />
        </Field>

        {!isPendingMode && (
          <Field
            label="Nombre de quien recibe"
            required
            help="Captura el nombre completo de la persona que recibirá el efectivo."
          >
            <input
              className={inputClass}
              placeholder="Nombre completo"
              disabled={!isFormEnabled}
              value={formData.receiverName}
              onChange={(event) =>
                updateField("receiverName", event.target.value)
              }
            />
          </Field>
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