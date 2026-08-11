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
  error?: string;
  /** @deprecated Sin efecto, todos los inputs usan el mismo estilo neutral */
  colorVariant?: "withdrawal" | "deposit" | "neutral";
};

const inputBase = "field-input";

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
  error,
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
          style={{ paddingLeft: "2.75rem" }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      </div>

      {error && (
        <p id={`${id}-error`} className="mt-2 text-sm font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
