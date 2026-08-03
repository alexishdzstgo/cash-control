"use client";

type AmountFieldProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  min?: number;
  step?: number;
  className?: string;
  /** @deprecated Sin efecto, todos los inputs usan el mismo estilo neutral */
  colorVariant?: "withdrawal" | "deposit" | "neutral";
};

const inputBase =
  "w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-8 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400";

export function AmountField({
  id,
  value,
  onChange,
  label = "Monto",
  placeholder = "0.00",
  disabled = false,
  required = false,
  min = 0,
  step = 0.01,
  className = "",
}: AmountFieldProps) {
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-semibold text-slate-700"
      >
        {label}
      </label>

      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm text-slate-500">
          $
        </span>

        <input
          id={id}
          type="number"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          min={min}
          step={step}
          className={inputBase}
        />
      </div>
    </div>
  );
}