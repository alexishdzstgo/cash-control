"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ModalShell } from "@/components/shared/ModalShell";
import {
  type CommissionValidationIssue,
  parseCurrencyToCents,
  validateCommissionRuleCandidate,
} from "@/lib/commission";
import type {
  CommissionOperationType,
  CommissionRule,
  CommissionRuleStatus,
} from "@/types/commission";

export type CommissionDialogMode = "add" | "edit" | "replace" | "view";

export type CommissionRuleFormResult = {
  operationType: CommissionOperationType;
  minAmountCents: number;
  maxAmountCents: number | null;
  fixedAmountCents: number;
  status: CommissionRuleStatus;
  reason: string;
};

type CommissionRuleDialogProps = {
  mode: CommissionDialogMode;
  rule: CommissionRule | null;
  operationType: CommissionOperationType;
  existingRules: CommissionRule[];
  onClose: () => void;
  onSave: (result: CommissionRuleFormResult) => void;
};

export function CommissionRuleDialog({
  mode,
  rule,
  operationType,
  existingRules,
  onClose,
  onSave,
}: CommissionRuleDialogProps) {
  const isReadOnly = mode === "view";
  const [formState, setFormState] = useState(() => ({
    operationType: rule?.operationType ?? operationType,
    minAmount: centsToInput(rule?.minAmountCents),
    maxAmount: centsToInput(rule?.maxAmountCents),
    hasNoMax: rule?.maxAmountCents === null,
    fixedAmount: centsToInput(rule?.fixedAmountCents),
    status: rule?.status ?? "active",
    reason: "",
  }));
  const initialFormStateRef = useRef(formState);

  const isDirty =
    JSON.stringify(formState) !== JSON.stringify(initialFormStateRef.current);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && (isReadOnly || !isDirty)) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDirty, isReadOnly, onClose]);

  const parsed = useMemo(() => {
    const minAmountCents = parseCurrencyToCents(formState.minAmount);
    const maxAmountCents = formState.hasNoMax
      ? null
      : parseCurrencyToCents(formState.maxAmount);
    const fixedAmountCents = parseCurrencyToCents(formState.fixedAmount);

    return { minAmountCents, maxAmountCents, fixedAmountCents };
  }, [formState]);

  const parseErrors: CommissionValidationIssue[] = [];
  if (parsed.minAmountCents === null) {
    parseErrors.push({
      code: "inverted_range",
      message: "Captura un monto mínimo válido.",
    });
  }
  if (!formState.hasNoMax && parsed.maxAmountCents === null) {
    parseErrors.push({
      code: "inverted_range",
      message: "Captura un monto máximo válido.",
    });
  }
  if (parsed.fixedAmountCents === null) {
    parseErrors.push({
      code: "negative_commission",
      message: "Captura una comisión válida.",
    });
  }
  if (formState.reason.trim() === "" && mode !== "view") {
    parseErrors.push({
      code: "zero_commission_requires_reason",
      message: "El motivo del cambio es obligatorio.",
    });
  }

  const validation =
    parsed.minAmountCents !== null && parsed.fixedAmountCents !== null
      ? validateCommissionRuleCandidate(
          {
            id: mode === "edit" ? rule?.id : undefined,
            operationType: formState.operationType,
            minAmountCents: parsed.minAmountCents,
            maxAmountCents: parsed.maxAmountCents,
            calculationType: "fixed",
            fixedAmountCents: parsed.fixedAmountCents,
            status: formState.status,
            zeroCommissionReason: formState.reason,
          },
          existingRules,
        )
      : { errors: [], warnings: [] };

  const errors = [...parseErrors, ...validation.errors];
  const canSave = !isReadOnly && errors.length === 0;
  const title =
    mode === "add"
      ? "Agregar rango"
      : mode === "replace"
        ? "Reemplazar regla"
        : mode === "edit"
          ? "Editar regla"
          : "Detalle de regla";

  return (
    <ModalShell
      title={title}
      description="Comisiones"
      onClose={() => {
        if (isReadOnly || !isDirty) {
          onClose();
        }
      }}
      closeOnOverlayClick={isReadOnly || !isDirty}
      maxWidth="lg"
      labelledById="commission-rule-title"
      footer={
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">
            {isReadOnly ? "Cerrar" : "Cancelar"}
          </button>
          {!isReadOnly && (
            <button
              type="button"
              disabled={!canSave}
              onClick={() => {
                if (
                  parsed.minAmountCents === null ||
                  parsed.fixedAmountCents === null
                ) {
                  return;
                }
                onSave({
                  operationType: formState.operationType,
                  minAmountCents: parsed.minAmountCents,
                  maxAmountCents: parsed.maxAmountCents,
                  fixedAmountCents: parsed.fixedAmountCents,
                  status: formState.status,
                  reason: formState.reason,
                });
              }}
              className="btn-primary disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
            >
              Guardar
            </button>
          )}
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Tipo de operacion">
          <select
            value={formState.operationType}
            disabled={isReadOnly || mode !== "add"}
            onChange={(event) =>
              setFormState({
                ...formState,
                operationType: event.target.value as CommissionOperationType,
              })
            }
            className={inputClass}
          >
            <option value="deposito">Deposito</option>
            <option value="retiro">Retiro</option>
          </select>
        </Field>

        <Field label="Estado">
          <select
            value={formState.status}
            disabled={isReadOnly}
            onChange={(event) =>
              setFormState({
                ...formState,
                status: event.target.value as CommissionRuleStatus,
              })
            }
            className={inputClass}
          >
            <option value="active">Activa</option>
            <option value="inactive">Inactiva</option>
          </select>
        </Field>

        <Field label="Monto minimo">
          <input
            type="text"
            value={formState.minAmount}
            disabled={isReadOnly}
            onChange={(event) =>
              setFormState({ ...formState, minAmount: event.target.value })
            }
            className={inputClass}
            placeholder="15.00"
          />
        </Field>

        <Field label="Monto maximo">
          <input
            type="text"
            value={formState.maxAmount}
            disabled={isReadOnly || formState.hasNoMax}
            onChange={(event) =>
              setFormState({ ...formState, maxAmount: event.target.value })
            }
            className={inputClass}
            placeholder="50.99"
          />
          <label className="mt-2 flex items-center gap-2 text-xs font-medium text-slate-500">
            <input
              type="checkbox"
              checked={formState.hasNoMax}
              disabled={isReadOnly}
              onChange={(event) =>
                setFormState({
                  ...formState,
                  hasNoMax: event.target.checked,
                  maxAmount: event.target.checked ? "" : formState.maxAmount,
                })
              }
            />
            Sin limite maximo
          </label>
        </Field>

        <Field label="Comision fija">
          <input
            type="text"
            value={formState.fixedAmount}
            disabled={isReadOnly}
            onChange={(event) =>
              setFormState({ ...formState, fixedAmount: event.target.value })
            }
            className={inputClass}
            placeholder="5.00"
          />
        </Field>

        <div className="md:col-span-2">
          <Field label="Motivo del cambio">
            <textarea
              rows={3}
              value={formState.reason}
              disabled={isReadOnly}
              onChange={(event) =>
                setFormState({ ...formState, reason: event.target.value })
              }
              className={inputClass}
              placeholder="Describe por que se modifica esta regla"
            />
          </Field>
        </div>
      </div>

      {errors.length > 0 && !isReadOnly && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <ul className="space-y-1 text-sm text-red-700">
            {errors.map((error, index) => (
              <li key={`${error.code}-${index}`}>{error.message}</li>
            ))}
          </ul>
        </div>
      )}

      {rule?.hasBeenApplied && mode !== "view" && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Esta regla ya fue aplicada. Al guardarla se creara una nueva version y
          la regla anterior quedara inactiva.
        </div>
      )}
    </ModalShell>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="cc-form-label mb-2 block text-sm font-semibold">
        {label}
      </div>
      {children}
    </div>
  );
}

function centsToInput(cents?: number | null): string {
  if (cents === undefined || cents === null) {
    return "";
  }
  return (cents / 100).toFixed(2);
}

const inputClass =
  "field-input rounded-xl px-4 py-3 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400";
