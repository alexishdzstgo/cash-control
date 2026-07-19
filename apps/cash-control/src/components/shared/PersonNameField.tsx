"use client";

type PersonNameFieldProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  autoComplete?: string;
  className?: string;
  colorVariant?: "withdrawal" | "deposit" | "neutral";
};

const focusStyles: Record<
  NonNullable<PersonNameFieldProps["colorVariant"]>,
  string
> = {
  withdrawal:
    "focus:border-withdrawal-400 focus:bg-white focus:ring-4 focus:ring-withdrawal-50",
  deposit:
    "focus:border-deposit-border focus:bg-white focus:ring-4 focus:ring-deposit-ring",
  neutral:
    "focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100",
};

const baseInputClass =
  "w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400";

export function PersonNameField({
  id,
  value,
  onChange,
  label,
  placeholder = "Nombre completo",
  disabled = false,
  required = false,
  autoComplete = "name",
  className = "",
  colorVariant = "neutral",
}: PersonNameFieldProps) {
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-semibold text-slate-700"
      >
        {label}
      </label>

      <input
        id={id}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        autoComplete={autoComplete}
        className={`${baseInputClass} ${focusStyles[colorVariant]}`}
      />
    </div>
  );
}