"use client";

import { useEffect, useRef } from "react";
import { getFolioStatus } from "@/lib/folio";
import type { FolioStatus } from "@/types/folio";

type FolioFieldProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onStatusChange?: (status: FolioStatus) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  colorVariant?: "withdrawal" | "deposit" | "neutral";
  showStatusMessages?: boolean;
  focusKey?: string;
  className?: string;
  messages?: Partial<Record<FolioStatus, string>>;
};

const inputBase =
  "w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400";

const inputVariants: Record<string, string> = {
  withdrawal:
    "border-slate-300 focus:border-withdrawal-400 focus:bg-white focus:ring-4 focus:ring-withdrawal-50",
  deposit:
    "border-slate-300 focus:border-deposit-border focus:bg-white focus:ring-4 focus:ring-deposit-ring",
  neutral:
    "border-slate-300 focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100",
};

const inputDuplicate =
  "border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-100";

const messageVariants: Record<string, string> = {
  withdrawal: "text-emerald-600",
  deposit: "text-emerald-600",
  neutral: "text-emerald-600",
};

const defaultMessages: Record<FolioStatus, string> = {
  empty: "Captura el folio para habilitar el resto del formulario.",
  duplicate:
    "Este folio ya fue registrado anteriormente. No se puede continuar.",
  available: "Folio disponible. Puedes continuar con la captura.",
};

export function FolioField({
  id,
  value,
  onChange,
  onStatusChange,
  label = "Folio bancario",
  placeholder = "Ej. 458732",
  disabled = false,
  required = true,
  colorVariant = "neutral",
  showStatusMessages = true,
  focusKey,
  className = "",
  messages,
}: FolioFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const status = getFolioStatus(value);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (focusKey !== undefined) {
      inputRef.current?.focus();
    }
  }, [focusKey]);

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  const inputClassName = [
    inputBase,
    status === "duplicate" ? inputDuplicate : inputVariants[colorVariant],
  ].join(" ");

  function getMessage(): string | null {
    if (!showStatusMessages) {
      return null;
    }

    if (messages?.[status] !== undefined) {
      return messages[status] as string;
    }

    return defaultMessages[status];
  }

  function getMessageClassName(): string {
    if (status === "empty") {
      return "mt-2 text-sm text-slate-500";
    }

    if (status === "duplicate") {
      return "mt-2 text-sm font-medium text-red-600";
    }

    return `mt-2 text-sm font-medium ${messageVariants[colorVariant]}`;
  }

  const message = getMessage();

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-semibold text-slate-700"
      >
        {label}
        {required && (
          <span className="ml-1 text-red-500" aria-label="Campo obligatorio">
            *
          </span>
        )}
      </label>

      <input
        ref={inputRef}
        id={id}
        type="text"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className={inputClassName}
      />

      {message !== null && (
        <p className={getMessageClassName()}>{message}</p>
      )}
    </div>
  );
}