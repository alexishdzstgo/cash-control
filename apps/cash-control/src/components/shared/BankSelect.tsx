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
  colorVariant?: "withdrawal" | "deposit" | "neutral";
};

const focusStyles: Record<
  NonNullable<BankSelectProps["colorVariant"]>,
  string
> = {
  withdrawal:
    "focus:border-withdrawal-400 focus:bg-white focus:ring-4 focus:ring-withdrawal-50",
  deposit:
    "focus:border-deposit-border focus:bg-white focus:ring-4 focus:ring-deposit-ring",
  neutral:
    "focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100",
};

export function BankSelect({
  id,
  value,
  onChange,
  label = "Banco",
  placeholder = "Selecciona un banco",
  disabled = false,
  className = "",
  colorVariant = "neutral",
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
        className={`w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 ${focusStyles[colorVariant]}`}
      >
        <option value="">{placeholder}</option>

        {bankOptions.map((bank) => (
          <option key={bank.value} value={bank.value}>
            {bank.label}
          </option>
        ))}
      </select>
    </div>
  );
}