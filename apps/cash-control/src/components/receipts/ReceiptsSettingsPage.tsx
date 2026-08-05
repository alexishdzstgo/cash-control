"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { buildReceiptData } from "@/lib/receipt";
import { mockOperations } from "@/components/history/mockOperations";
import type { ReceiptPaperSize } from "@/types/receipt";
import { ReceiptDocument } from "./ReceiptDocument";
import { useReceiptPreferences } from "./ReceiptPreferencesContext";

const previewOptions = [
  { label: "Depósito completado", operationId: "2" },
  { label: "Depósito pendiente", operationId: "2", pending: true },
  { label: "Retiro entregado", operationId: "1" },
  { label: "Retiro pendiente", operationId: "3" },
];

export function ReceiptsSettingsPage() {
  const {
    businessIdentity,
    setBusinessIdentity,
    preferences,
    setPreferences,
  } = useReceiptPreferences();
  const previewOperation = mockOperations[1];
  const receiptData = buildReceiptData({ operation: previewOperation });

  return (
    <div>
      <PageHeader
        title="Comprobantes"
        description="Configura cómo se entregarán los comprobantes al cliente."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
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
                label="Teléfono"
                value={businessIdentity.phone ?? ""}
                onChange={(phone) =>
                  setBusinessIdentity((current) => ({ ...current, phone }))
                }
              />
              <TextField
                label="Dirección"
                value={businessIdentity.address ?? ""}
                onChange={(address) =>
                  setBusinessIdentity((current) => ({ ...current, address }))
                }
              />
              <TextField
                label="Texto de encabezado"
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
                label="Abrir vista previa después de registrar"
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
              Selecciona en el diálogo de impresión el tamaño de papel
              configurado para la impresora.
            </p>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">
              Contenido visible
            </h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[
                "Tipo de operación",
                "Folio",
                "ID interno",
                "Fecha y hora",
                "Monto",
                "Comisión",
                "Total",
                "Estado",
                "Usuario que registró",
              ].map((label) => (
                <div
                  key={label}
                  className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-slate-900">{label}</span>
                  <span className="ml-2 text-xs text-slate-500">
                    Siempre visible
                  </span>
                </div>
              ))}
              <CheckboxField
                label="Teléfono"
                checked={preferences.showPhone}
                onChange={(showPhone) =>
                  setPreferences((current) => ({ ...current, showPhone }))
                }
              />
              <CheckboxField
                label="Dirección"
                checked={preferences.showAddress}
                onChange={(showAddress) =>
                  setPreferences((current) => ({ ...current, showAddress }))
                }
              />
              <CheckboxField
                label="Firma"
                checked={preferences.showSignatureSpace}
                onChange={(showSignatureSpace) =>
                  setPreferences((current) => ({
                    ...current,
                    showSignatureSpace,
                  }))
                }
              />
              <CheckboxField
                label="Observaciones"
                checked={preferences.showObservations}
                onChange={(showObservations) =>
                  setPreferences((current) => ({
                    ...current,
                    showObservations,
                  }))
                }
              />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Mensajes</h2>
            <div className="mt-4 grid gap-4">
              <TextField
                label="Agradecimiento"
                value={preferences.footerMessage ?? ""}
                onChange={(footerMessage) =>
                  setPreferences((current) => ({ ...current, footerMessage }))
                }
              />
              <TextField
                label="Aclaraciones"
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

          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Los cambios son de demostración y no se conservarán al recargar.
          </p>
        </div>

        <aside className="xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">
              Vista previa
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Ejemplo con datos mock actuales.
            </p>
            <div className="mt-4 overflow-x-auto rounded-lg bg-slate-100 p-4">
              <ReceiptDocument
                data={receiptData}
                businessIdentity={businessIdentity}
                preferences={preferences}
              />
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
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
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
            {option}
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
