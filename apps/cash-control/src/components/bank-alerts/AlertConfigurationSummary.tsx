"use client";

import { Save, Settings2, X } from "lucide-react";
import { type Dispatch, type SetStateAction, useState } from "react";
import { ModalSection, ModalShell } from "@/components/shared/ModalShell";
import type {
  FinancialAlertConfig,
  FinancialResourceView,
} from "@/lib/financialAlerts";

type AlertConfigurationSummaryProps = {
  resources: FinancialResourceView[];
  config: FinancialAlertConfig;
  onSave: (config: FinancialAlertConfig) => void;
};

type ValidationErrors = Record<string, string>;

export function AlertConfigurationSummary({
  resources,
  config,
  onSave,
}: AlertConfigurationSummaryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(config);
  const [errors, setErrors] = useState<ValidationErrors>({});

  function openModal() {
    setDraft(config);
    setErrors({});
    setIsOpen(true);
  }

  function saveConfiguration() {
    const nextErrors = validateConfig(draft, banks);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSave(draft);
    setIsOpen(false);
  }

  const banks = resources.filter((resource) => resource.type === "bank");

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="btn-primary min-h-10"
      >
        <Settings2 className="h-4 w-4" aria-hidden="true" />
        Configurar alertas
      </button>

      {isOpen && (
        <ModalShell
          title="Configurar alertas"
          description="Ajusta umbrales operativos temporales. Esta configuración vive en memoria hasta conectar persistencia."
          onClose={() => setIsOpen(false)}
          maxWidth="xl"
          footer={
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="btn-secondary"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveConfiguration}
                className="btn-primary"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                Guardar configuración
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <ModalSection>
              <h3 className="text-sm font-semibold uppercase text-surface-text-label">
                Caja física
              </h3>
              <div className="mt-4">
                <NumberField
                  label="Avisarme cuando el disponible sea menor o igual a"
                  value={draft.cash.lowBalanceThreshold ?? 0}
                  prefix="$"
                  error={errors.cashLowBalanceThreshold}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      cash: {
                        ...current.cash,
                        lowBalanceThreshold: value,
                      },
                    }))
                  }
                />
              </div>
            </ModalSection>

            {banks.map((bank) => {
              const bankConfig = draft.banks[bank.id] ?? {};
              return (
                <ModalSection key={bank.id}>
                  <h3 className="text-sm font-semibold uppercase text-surface-text-label">
                    {bank.name}
                  </h3>
                  <div
                    className={`mt-4 grid gap-4 ${
                      bank.supportsVisibleMovementTracking
                        ? "md:grid-cols-3"
                        : "md:grid-cols-1"
                    }`}
                  >
                    <NumberField
                      label="Saldo mínimo para operar"
                      value={bankConfig.lowBalanceThreshold ?? 0}
                      prefix="$"
                      error={errors[`${bank.id}.lowBalanceThreshold`]}
                      onChange={(value) =>
                        setBankValue({
                          bankId: bank.id,
                          key: "lowBalanceThreshold",
                          value,
                          setDraft,
                        })
                      }
                    />
                    {bank.supportsVisibleMovementTracking && (
                      <>
                        <NumberField
                          label="Límite de movimientos visibles"
                          helpText="Máximo de movimientos que la app del banco permite consultar."
                          value={bankConfig.visibleMovementLimit ?? 0}
                          error={errors[`${bank.id}.visibleMovementLimit`]}
                          onChange={(value) =>
                            setBankValue({
                              bankId: bank.id,
                              key: "visibleMovementLimit",
                              value,
                              setDraft,
                            })
                          }
                        />
                        <NumberField
                          label="Avisar cuando queden"
                          helpText="Genera una alerta cuando resten esta cantidad de movimientos antes de llegar al límite."
                          value={bankConfig.movementWarningRemaining ?? 0}
                          error={errors[`${bank.id}.movementWarningRemaining`]}
                          onChange={(value) =>
                            setBankValue({
                              bankId: bank.id,
                              key: "movementWarningRemaining",
                              value,
                              setDraft,
                            })
                          }
                        />
                      </>
                    )}
                  </div>
                </ModalSection>
              );
            })}
          </div>
        </ModalShell>
      )}
    </>
  );
}

function NumberField({
  label,
  value,
  onChange,
  error,
  prefix,
  helpText,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  error?: string;
  prefix?: string;
  helpText?: string;
}) {
  return (
    <label className="block">
      <span className="cc-form-label text-sm font-semibold">{label}</span>
      <div className="mt-2 flex items-center rounded-lg border border-surface-border bg-white focus-within:border-primary-blue focus-within:ring-3 focus-within:ring-primary-blue/15">
        {prefix && (
          <span className="pl-3 text-sm font-semibold text-surface-text-secondary">
            {prefix}
          </span>
        )}
        <input
          type="number"
          min="0"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="min-h-10 w-full rounded-lg bg-white px-3 text-sm font-semibold text-surface-text-primary outline-none"
        />
      </div>
      {error && (
        <p className="mt-1 text-xs font-medium text-red-600">{error}</p>
      )}
      {helpText && !error && (
        <p className="mt-1 text-xs leading-5 text-surface-text-secondary">
          {helpText}
        </p>
      )}
    </label>
  );
}

function setBankValue({
  bankId,
  key,
  value,
  setDraft,
}: {
  bankId: string;
  key: keyof FinancialAlertConfig["banks"][string];
  value: number;
  setDraft: Dispatch<SetStateAction<FinancialAlertConfig>>;
}) {
  setDraft((current) => ({
    ...current,
    banks: {
      ...current.banks,
      [bankId]: {
        ...current.banks[bankId],
        [key]: value,
      },
    },
  }));
}

function validateConfig(
  config: FinancialAlertConfig,
  banks: FinancialResourceView[],
): ValidationErrors {
  const errors: ValidationErrors = {};

  if ((config.cash.lowBalanceThreshold ?? 0) < 0) {
    errors.cashLowBalanceThreshold = "El saldo mínimo no puede ser negativo.";
  }

  for (const [bankId, bankConfig] of Object.entries(config.banks)) {
    if ((bankConfig.lowBalanceThreshold ?? 0) < 0) {
      errors[`${bankId}.lowBalanceThreshold`] =
        "El saldo mínimo no puede ser negativo.";
    }

    const bank = banks.find((resource) => resource.id === bankId);
    if (!bank?.supportsVisibleMovementTracking) continue;

    const limit = bankConfig.visibleMovementLimit ?? 0;
    const warningRemaining = bankConfig.movementWarningRemaining ?? 0;

    if (limit <= 0) {
      errors[`${bankId}.visibleMovementLimit`] =
        "El límite de movimientos debe ser mayor a cero.";
    }

    if (warningRemaining < 0) {
      errors[`${bankId}.movementWarningRemaining`] =
        "El aviso de movimientos no puede ser negativo.";
    } else if (warningRemaining > limit) {
      errors[`${bankId}.movementWarningRemaining`] =
        "El aviso no puede ser mayor que el límite total.";
    }
  }

  return errors;
}
