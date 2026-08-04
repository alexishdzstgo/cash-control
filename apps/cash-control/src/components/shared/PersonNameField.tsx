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
  /** @deprecated Sin efecto, todos los inputs usan el mismo estilo neutral */
  colorVariant?: "withdrawal" | "deposit" | "neutral";
};

const baseInputClass =
  "field-input px-4 py-3";

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
        className={baseInputClass}
      />
    </div>
  );
}