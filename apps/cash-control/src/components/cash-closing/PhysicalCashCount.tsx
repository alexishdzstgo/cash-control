"use client";

import type { ChangeEvent } from "react";
import { useId } from "react";

type PhysicalCashCountProps = {
  countedCash: string;
  onCountedCashChange: (value: string) => void;
  disabled?: boolean;
};

export function PhysicalCashCount({
  countedCash,
  onCountedCashChange,
  disabled = false,
}: PhysicalCashCountProps) {
  const inputId = useId();
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.target.value;

    if (rawValue === "") {
      onCountedCashChange("");
      return;
    }

    const sanitized = rawValue.replace(/[^0-9.]/g, "");
    const parts = sanitized.split(".");

    if (parts.length > 2) {
      return;
    }

    if (parts[1] && parts[1].length > 2) {
      return;
    }

    onCountedCashChange(sanitized);
  };

  const numericValue = countedCash === "" ? NaN : Number(countedCash);
  const hasInvalidValue = countedCash !== "" && Number.isNaN(numericValue);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-400">
        Conteo físico
      </h3>

      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-slate-700"
      >
        Efectivo contado
      </label>

      <div className="relative mt-1">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-slate-500">
          $
        </span>
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          value={countedCash}
          onChange={handleChange}
          disabled={disabled}
          placeholder="0.00"
          className={`w-full rounded-xl border bg-white py-2.5 pr-4 pl-7 text-sm text-slate-900 outline-none transition ${
            hasInvalidValue
              ? "border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500"
              : "border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
          } ${disabled ? "cursor-not-allowed bg-slate-50 text-slate-500" : ""}`}
        />
      </div>

      <p className="mt-2 text-xs text-slate-500">
        Captura el total de efectivo que se encuentra físicamente en caja.
      </p>

      {hasInvalidValue && (
        <p className="mt-1 text-xs text-red-600">Ingresa un monto válido.</p>
      )}
    </div>
  );
}
