"use client";

import { AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  buildReceiptData,
  getReceiptConfigurationWarnings,
  getReceiptFieldVisibility,
} from "@/lib/receipt";
import type { ReceiptFieldVisibility, ReceiptPaperSize } from "@/types/receipt";
import { ReceiptDocument } from "./ReceiptDocument";
import { useReceiptPreferences } from "./ReceiptPreferencesContext";
import { receiptPreviewOperations } from "./receiptMockData";

type FieldKey = keyof ReceiptFieldVisibility;

const previewOptions = [
  { label: "Deposito completado", value: "completedDeposit" },
  { label: "Deposito pendiente", value: "pendingDeposit" },
  { label: "Retiro entregado", value: "deliveredWithdrawal" },
  { label: "Retiro pendiente", value: "pendingWithdrawal" },
] as const;

const fieldGroups: Array<{
  title: string;
  fields: Array<{ key: FieldKey; label: string }>;
}> = [
  {
    title: "Informacion principal",
    fields: [
      { key: "showBusinessName", label: "Nombre del negocio" },
      { key: "showOperationType", label: "Tipo de operacion" },
      { key: "showDate", label: "Fecha" },
      { key: "showTime", label: "Hora" },
      { key: "showAmount", label: "Cantidad" },
      { key: "showCommission", label: "Comision" },
      { key: "showTotal", label: "Total" },
      { key: "showFolio", label: "Folio" },
      { key: "showOperationId", label: "Identificador interno" },
    ],
  },
  {
    title: "Personas",
    fields: [
      { key: "showSender", label: "Nombre de quien envia" },
      {
        key: "showReceiver",
        label: "Nombre de quien recibe el efectivo completo",
      },
      { key: "showBeneficiary", label: "Beneficiario" },
      { key: "showRegisteredBy", label: "Usuario que registro" },
      { key: "showDeliveredBy", label: "Persona que entrego" },
      { key: "showResponsibleUser", label: "Responsable del turno" },
    ],
  },
  {
    title: "Operacion",
    fields: [
      { key: "showBank", label: "Banco" },
      { key: "showStatus", label: "Estado" },
      { key: "showEditedIndicator", label: "Operacion corregida" },
      { key: "showObservations", label: "Observaciones" },
    ],
  },
  {
    title: "Negocio y mensajes",
    fields: [
      { key: "showPhone", label: "Telefono" },
      { key: "showAddress", label: "Direccion" },
      { key: "showHeaderMessage", label: "Mensaje superior" },
      { key: "showFooterMessage", label: "Mensaje final" },
      { key: "showClarificationMessage", label: "Aviso de aclaraciones" },
      { key: "showSignatureSpace", label: "Firma" },
    ],
  },
];

export function ReceiptsSettingsPage() {
  const { businessIdentity, setBusinessIdentity, preferences, setPreferences } =
    useReceiptPreferences();
  const [previewOption, setPreviewOption] =
    useState<keyof typeof receiptPreviewOperations>("completedDeposit");
  const previewOperation = receiptPreviewOperations[previewOption];
  const receiptData = useMemo(
    () => buildReceiptData({ operation: previewOperation }),
    [previewOperation],
  );
  const visibility = getReceiptFieldVisibility(
    preferences,
    receiptData.operationType,
  );
  const warnings = getReceiptConfigurationWarnings(visibility);

  function updateVisibility(key: FieldKey, checked: boolean) {
    setPreferences((current) => ({
      ...current,
      fieldVisibility: {
        ...current.fieldVisibility,
        [key]: checked,
      },
    }));
  }

  return (
    <div>
      <PageHeader
        title="Comprobantes"
        description="Configura los campos visibles del comprobante impreso sin cambiar los datos internos de la operacion."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Identidad</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <TextField
                label="Nombre comercial"
                value={businessIdentity.businessName}
                onChange={(businessName) =>
                  setBusinessIdentity((current) => ({
                    ...current,
                    businessName,
                  }))
                }
              />
              <TextField
                label="Telefono"
                value={businessIdentity.phone ?? ""}
                onChange={(phone) =>
                  setBusinessIdentity((current) => ({ ...current, phone }))
                }
              />
              <TextField
                label="Direccion"
                value={businessIdentity.address ?? ""}
                onChange={(address) =>
                  setBusinessIdentity((current) => ({ ...current, address }))
                }
              />
              <TextField
                label="Mensaje superior"
                value={preferences.headerMessage ?? ""}
                onChange={(headerMessage) =>
                  setPreferences((current) => ({ ...current, headerMessage }))
                }
              />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Formato</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <SelectField
                label="Papel"
                value={preferences.paperSize}
                onChange={(paperSize) =>
                  setPreferences((current) => ({
                    ...current,
                    paperSize: paperSize as ReceiptPaperSize,
                  }))
                }
                options={["58mm", "80mm", "digital"]}
              />
              <NumberField
                label="Copias"
                value={preferences.copies}
                onChange={(copies) =>
                  setPreferences((current) => ({ ...current, copies }))
                }
              />
              <CheckboxField
                label="Abrir vista previa despues de registrar"
                checked={preferences.autoOpenAfterRegister}
                onChange={(autoOpenAfterRegister) =>
                  setPreferences((current) => ({
                    ...current,
                    autoOpenAfterRegister,
                  }))
                }
              />
            </div>
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Selecciona en el dialogo de impresion el tamano de papel
              configurado para la impresora.
            </p>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">
              Contenido visible
            </h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {fieldGroups.map((group) => (
                <div
                  key={group.title}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <h3 className="text-sm font-semibold text-slate-900">
                    {group.title}
                  </h3>
                  <div className="mt-3 grid gap-2">
                    {group.fields.map((field) => (
                      <CheckboxField
                        key={field.key}
                        label={field.label}
                        checked={preferences.fieldVisibility[field.key]}
                        onChange={(checked) =>
                          updateVisibility(field.key, checked)
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Mensajes</h2>
            <div className="mt-4 grid gap-4">
              <TextField
                label="Mensaje final"
                value={preferences.footerMessage ?? ""}
                onChange={(footerMessage) =>
                  setPreferences((current) => ({ ...current, footerMessage }))
                }
              />
              <TextField
                label="Aviso de aclaraciones"
                value={preferences.clarificationMessage ?? ""}
                onChange={(clarificationMessage) =>
                  setPreferences((current) => ({
                    ...current,
                    clarificationMessage,
                  }))
                }
              />
            </div>
          </section>

          {warnings.length > 0 && (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <h2 className="font-semibold">Advertencias</h2>
                  <ul className="mt-2 space-y-1">
                    {warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          )}

          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Los cambios de esta demostracion no se conservaran al recargar.
          </p>
        </div>

        <aside className="xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">
              Vista previa
            </h2>
            <div className="mt-4">
              <SelectField
                label="Operacion de ejemplo"
                value={previewOption}
                onChange={(value) =>
                  setPreviewOption(
                    value as keyof typeof receiptPreviewOperations,
                  )
                }
                options={previewOptions.map((option) => option.value)}
                getOptionLabel={(value) =>
                  previewOptions.find((option) => option.value === value)
                    ?.label ?? value
                }
              />
            </div>
            <div className="mt-4 overflow-x-auto rounded-lg bg-slate-100 p-4">
              <div className="receipt-print-root mx-auto w-fit">
                <ReceiptDocument
                  data={receiptData}
                  businessIdentity={businessIdentity}
                  preferences={preferences}
                />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 1)}
        className={inputClass}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  getOptionLabel,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  getOptionLabel?: (value: string) => string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {getOptionLabel ? getOptionLabel(option) : option}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 font-sans text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100";
