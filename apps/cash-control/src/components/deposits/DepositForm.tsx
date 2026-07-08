"use client";

import { useEffect, useRef, useState } from "react";

type FolioStatus = "empty" | "duplicate" | "available";

interface DepositFormProps {
  onFolioStatusChange: (status: FolioStatus) => void;
}

export function DepositForm({ onFolioStatusChange }: DepositFormProps) {
  const [folio, setFolio] = useState("");
  const folioInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    folioInputRef.current?.focus();
  }, []);

  const folioStatus: FolioStatus =
    folio.trim() === ""
      ? "empty"
      : folio.trim() === "12345"
        ? "duplicate"
        : "available";

  useEffect(() => {
    onFolioStatusChange(folioStatus);
  }, [folioStatus, onFolioStatusChange]);

  const isFormEnabled = folioStatus === "available";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-950">
          Datos del depósito
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Primero captura el folio bancario para verificar que no haya sido
          entregado.
        </p>
      </div>

      <form className="space-y-6">
        <Field label="Folio bancario">
          <input
            ref={folioInputRef}
            className={inputClass}
            placeholder="Ej. 837291045"
            value={folio}
            onChange={(event) => setFolio(event.target.value)}
          />

          {folioStatus === "empty" && (
            <p className="mt-2 text-sm text-slate-500">
              Captura el folio para habilitar el resto del formulario.
            </p>
          )}

          {folioStatus === "available" && (
            <p className="mt-2 text-sm font-medium text-green-600">
              Folio disponible. Puedes continuar con la captura.
            </p>
          )}

          {folioStatus === "duplicate" && (
            <p className="mt-2 text-sm font-medium text-amber-600">
              Este folio ya fue registrado anteriormente. No se puede continuar.
            </p>
          )}
        </Field>

        <Field label="Monto">
          <input
            className={inputClass}
            placeholder="$0.00"
            disabled={!isFormEnabled}
          />
        </Field>

        <Field label="Banco">
          <select className={inputClass} disabled={!isFormEnabled}>
            <option>Banco Azteca</option>
            <option>BBVA</option>
            <option>Banamex</option>
          </select>
        </Field>

        <Field label="Nombre de quien envía">
          <input
            className={inputClass}
            placeholder="Nombre completo"
            disabled={!isFormEnabled}
          />
        </Field>

        <Field
          label="Nombre de quien recibe"
          help="En el ticket se dejará espacio para nombre completo y firma."
        >
          <input
            className={inputClass}
            placeholder="Opcional"
            disabled={!isFormEnabled}
          />
        </Field>

        <Field label="Observaciones">
          <textarea
            className={`${inputClass} min-h-28 resize-none`}
            placeholder="Opcional. No aparecerá en el ticket."
            disabled={!isFormEnabled}
          />
        </Field>
      </form>
    </section>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400";

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-base font-semibold text-slate-800">{label}</label>
      <div className="mt-2">{children}</div>
      {help && <p className="mt-2 text-sm text-slate-500">{help}</p>}
    </div>
  );
}