"use client";

import { AmountField } from "@/components/shared/AmountField";
import { BankSelect } from "@/components/shared/BankSelect";
import { FolioField } from "@/components/shared/FolioField";
import { PersonNameField } from "@/components/shared/PersonNameField";
import { getFolioStatus } from "@/lib/folio";
import type { FolioStatus } from "@/types/folio";
import type {
  DepositDeliveryMethod,
  DepositFormData,
  DepositMode,
  DepositPendingReason,
} from "@/types/deposit";

type DepositFormProps = {
  mode: DepositMode;
  formData: DepositFormData;
  onFormDataChange: (
    formData: DepositFormData,
  ) => void;
  onFolioStatusChange: (
    status: FolioStatus,
  ) => void;
};

const deliveryMethods: Array<{
  value: DepositDeliveryMethod;
  label: string;
}> = [
  {
    value: "bank-transfer",
    label: "Transferencia bancaria",
  },
  {
    value: "cash-deposit",
    label: "Depósito en efectivo",
  },
];

const pendingReasons: Array<{
  value: Exclude<DepositPendingReason, "">;
  label: string;
}> = [
  {
    value: "bank-unavailable",
    label: "Servicio bancario no disponible",
  },
  {
    value: "insufficient-bank-balance",
    label: "Saldo insuficiente en la cuenta",
  },
  {
    value: "movement-limit",
    label: "Límite de movimientos alcanzado",
  },
  {
    value: "customer-request",
    label: "Solicitud del cliente",
  },
  {
    value: "other",
    label: "Otro motivo",
  },
];

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-deposit-border focus:bg-white focus:ring-4 focus:ring-deposit-ring";

const labelClass =
  "mb-2 block text-sm font-semibold text-slate-700";

export function DepositForm({
  mode,
  formData,
  onFormDataChange,
  onFolioStatusChange,
}: DepositFormProps) {
  const isPendingMode = mode === "pending";

  const isFormEnabled =
    getFolioStatus(formData.bankFolio) === "available";

  function updateField<
    Key extends keyof DepositFormData,
  >(
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
        <p
          className={`text-sm font-semibold ${
            isPendingMode
              ? "text-pending-text"
              : "text-deposit-text"
          }`}
        >
          Información de la operación
        </p>

        <h2 className="mt-1 text-lg font-semibold text-slate-900">
          Datos del depósito
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Registra el efectivo recibido y los
          datos del destino bancario.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <FolioField
          id="deposit-bank-folio"
          value={formData.bankFolio}
          onChange={(value) => updateField("bankFolio", value)}
          onStatusChange={onFolioStatusChange}
          label="Folio bancario"
          placeholder="Ej. 458732"
          colorVariant="deposit"
          showStatusMessages
          focusKey={mode}
        />

        <AmountField
          id="deposit-amount"
          value={formData.amount}
          onChange={(value) =>
            updateField("amount", value)
          }
          label="Monto recibido"
          placeholder="0.00"
          min={0}
          step={0.01}
          disabled={!isFormEnabled}
          colorVariant="deposit"
        />

        <PersonNameField
          id="deposit-sender"
          value={formData.senderName}
          onChange={(value) =>
            updateField("senderName", value)
          }
          label="Nombre de quien entrega el efectivo"
          placeholder="Nombre completo"
          disabled={!isFormEnabled}
          colorVariant="deposit"
        />

        <PersonNameField
          id="deposit-receiver"
          value={formData.receiverName}
          onChange={(value) =>
            updateField("receiverName", value)
          }
          label="Nombre de quien recibe"
          placeholder="Titular o beneficiario"
          disabled={!isFormEnabled}
          colorVariant="deposit"
        />

        <BankSelect
          id="deposit-bank"
          value={formData.destinationBank}
          onChange={(value) =>
            updateField("destinationBank", value)
          }
          label="Banco de destino"
          disabled={!isFormEnabled}
          colorVariant="deposit"
        />

        <div>
          <label
            htmlFor="deposit-method"
            className={labelClass}
          >
            Método de envío
          </label>

          <select
            id="deposit-method"
            value={formData.deliveryMethod}
            onChange={(event) =>
              updateField(
                "deliveryMethod",
                event.target
                  .value as DepositDeliveryMethod,
              )
            }
            disabled={!isFormEnabled}
            className={inputClass}
          >
            <option value="">
              Selecciona un método
            </option>

            {deliveryMethods.map(
              (method) => (
                <option
                  key={method.value}
                  value={method.value}
                >
                  {method.label}
                </option>
              ),
            )}
          </select>
        </div>

        <div className="md:col-span-2">
          <label
            htmlFor="deposit-reference"
            className={labelClass}
          >
            Cuenta, tarjeta, CLABE o referencia
            de destino
          </label>

          <input
            id="deposit-reference"
            type="text"
            value={
              formData.destinationReference
            }
            onChange={(event) =>
              updateField(
                "destinationReference",
                event.target.value,
              )
            }
            disabled={!isFormEnabled}
            placeholder="Captura los datos del destino"
            className={inputClass}
          />
        </div>

        {isPendingMode && (
          <>
            <div className="md:col-span-2">
              <label
                htmlFor="deposit-pending-reason"
                className={labelClass}
              >
                Motivo por el que queda pendiente
              </label>

              <select
                id="deposit-pending-reason"
                value={formData.pendingReason}
                onChange={(event) =>
                  updateField(
                    "pendingReason",
                    event.target
                      .value as DepositPendingReason,
                  )
                }
                disabled={!isFormEnabled}
                className={inputClass}
              >
                <option value="">
                  Selecciona un motivo
                </option>

                {pendingReasons.map(
                  (reason) => (
                    <option
                      key={reason.value}
                      value={reason.value}
                    >
                      {reason.label}
                    </option>
                  ),
                )}
              </select>
            </div>

            {formData.pendingReason ===
              "other" && (
              <div className="md:col-span-2">
                <label
                  htmlFor="deposit-pending-details"
                  className={labelClass}
                >
                  Describe el motivo
                </label>

                <textarea
                  id="deposit-pending-details"
                  rows={3}
                  value={
                    formData.pendingReasonDetails
                  }
                  onChange={(event) =>
                    updateField(
                      "pendingReasonDetails",
                      event.target.value,
                    )
                  }
                  disabled={!isFormEnabled}
                  placeholder="Explica por qué la operación no pudo completarse"
                  className={inputClass}
                />
              </div>
            )}
          </>
        )}

        <div className="md:col-span-2">
          <label
            htmlFor="deposit-observations"
            className={labelClass}
          >
            Observaciones
            <span className="ml-1 font-normal text-slate-400">
              (opcional)
            </span>
          </label>

          <textarea
            id="deposit-observations"
            rows={3}
            value={formData.observations}
            onChange={(event) =>
              updateField(
                "observations",
                event.target.value,
              )
            }
            disabled={!isFormEnabled}
            placeholder="Agrega alguna nota interna"
            className={inputClass}
          />
        </div>
      </div>
    </section>
  );
}