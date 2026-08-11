"use client";

import { bankOptions } from "@/config/banks";

type BankSelectProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: string;
  /** @deprecated Sin efecto, todos los inputs usan el mismo estilo neutral */
  colorVariant?: "withdrawal" | "deposit" | "neutral";
};

export function BankSelect({
  id,
  value,
  onChange,
  label = "Banco",
  placeholder = "Selecciona un banco",
  disabled = false,
  className = "",
  error,
}: BankSelectProps) {
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-semibold text-slate-700"
      >
        {label}
      </label>

      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="field-input px-4 py-3"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      >
        <option value="">{placeholder}</option>

        {bankOptions.map((bank) => (
          <option key={bank.value} value={bank.value}>
            {bank.label}
          </option>
        ))}
      </select>

      {error && (
        <p id={`${id}-error`} className="mt-2 text-sm font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
