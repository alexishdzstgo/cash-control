"use client";

import { Save, Settings2, X } from "lucide-react";
import { type Dispatch, type SetStateAction, useState } from "react";
import { ModalSection, ModalShell } from "@/components/shared/ModalShell";
import type {
  FinancialAlertConfig,
  FinancialResourceView,
} from "@/lib/financialAlerts";
import {
  focusFirstInvalidField,
  getValidationFieldProps,
} from "@/lib/formValidationFocus";

type AlertConfigurationSummaryProps = {
  resources: FinancialResourceView[];
  config: FinancialAlertConfig;
  onSave: (config: FinancialAlertConfig) => void;
};

type ValidationErrors = Record<string, string>;

const DEFAULT_VISIBLE_MOVEMENT_LIMIT = 20;
const DEFAULT_MOVEMENT_WARNING_REMAINING = 5;

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
    const nextErrors = validateConfig(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      focusFirstInvalidField({
        errors: nextErrors,
        fieldOrder: getAlertConfigFieldOrder(banks),
      });
      return;
    }

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
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <NumberField
                  validationKey="cashCriticalBalanceThreshold"
                  label="Saldo crítico"
                  helpText="Por debajo de esta cantidad el saldo se considera crítico."
                  value={draft.cash.criticalBalanceThreshold ?? 0}
                  prefix="$"
                  error={errors.cashCriticalBalanceThreshold}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      cash: {
                        ...current.cash,
                        criticalBalanceThreshold: value,
                      },
                    }))
                  }
                />
                <NumberField
                  validationKey="cashLowBalanceThreshold"
                  label="Saldo saludable"
                  helpText="A partir de esta cantidad el saldo se considera saludable."
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
                      bankConfig.visibleMovementTrackingEnabled
                        ? "md:grid-cols-3"
                        : "md:grid-cols-2"
                    }`}
                  >
                    <NumberField
                      validationKey={`${bank.id}.criticalBalanceThreshold`}
                      label="Saldo crítico"
                      helpText="Por debajo de esta cantidad el saldo se considera crítico."
                      value={bankConfig.criticalBalanceThreshold ?? 0}
                      prefix="$"
                      error={errors[`${bank.id}.criticalBalanceThreshold`]}
                      onChange={(value) =>
                        setBankValue({
                          bankId: bank.id,
                          key: "criticalBalanceThreshold",
                          value,
                          setDraft,
                        })
                      }
                    />
                    <NumberField
                      validationKey={`${bank.id}.lowBalanceThreshold`}
                      label="Saldo saludable"
                      helpText="A partir de esta cantidad el saldo se considera saludable."
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
                    <div className="md:col-span-full">
                      <TrackingSwitch
                        checked={
                          bankConfig.visibleMovementTrackingEnabled === true
                        }
                        onChange={(checked) =>
                          toggleMovementTracking({
                            bankId: bank.id,
                            checked,
                            currentConfig: bankConfig,
                            setDraft,
                          })
                        }
                      />
                    </div>
                    {bankConfig.visibleMovementTrackingEnabled && (
                      <>
                        <NumberField
                          validationKey={`${bank.id}.visibleMovementLimit`}
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
                          validationKey={`${bank.id}.movementWarningRemaining`}
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
  validationKey,
  label,
  value,
  onChange,
  error,
  prefix,
  helpText,
}: {
  validationKey: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  error?: string;
  prefix?: string;
  helpText?: string;
}) {
  const errorId = `${validationKey.replaceAll(".", "-")}-error`;

  return (
    <label className="block" {...getValidationFieldProps(validationKey)}>
      <span className="cc-form-label text-sm font-semibold">{label}</span>
      <div
        className={`mt-2 flex items-center rounded-lg border bg-white focus-within:ring-3 ${
          error
            ? "border-red-300 focus-within:border-red-500 focus-within:ring-red-500/15"
            : "border-surface-border focus-within:border-primary-blue focus-within:ring-primary-blue/15"
        }`}
      >
        {prefix && (
          <span className="pl-3 text-sm font-semibold text-surface-text-secondary">
            {prefix}
          </span>
        )}
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="min-h-10 w-full rounded-lg bg-white px-3 text-sm font-semibold text-surface-text-primary outline-none"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
      </div>
      {error && (
        <p id={errorId} className="mt-1 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
      {helpText && !error && (
        <p className="mt-1 text-xs leading-5 text-surface-text-secondary">
          {helpText}
        </p>
      )}
    </label>
  );
}

function getAlertConfigFieldOrder(
  banks: FinancialResourceView[],
): readonly string[] {
  return [
    "cashCriticalBalanceThreshold",
    "cashLowBalanceThreshold",
    ...banks.flatMap((bank) => [
      `${bank.id}.criticalBalanceThreshold`,
      `${bank.id}.lowBalanceThreshold`,
      `${bank.id}.visibleMovementLimit`,
      `${bank.id}.movementWarningRemaining`,
    ]),
  ];
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

function validateConfig(config: FinancialAlertConfig): ValidationErrors {
  const errors: ValidationErrors = {};

  validateBalanceThresholds({
    critical: config.cash.criticalBalanceThreshold,
    healthy: config.cash.lowBalanceThreshold,
    criticalKey: "cashCriticalBalanceThreshold",
    healthyKey: "cashLowBalanceThreshold",
    errors,
  });

  for (const [bankId, bankConfig] of Object.entries(config.banks)) {
    validateBalanceThresholds({
      critical: bankConfig.criticalBalanceThreshold,
      healthy: bankConfig.lowBalanceThreshold,
      criticalKey: `${bankId}.criticalBalanceThreshold`,
      healthyKey: `${bankId}.lowBalanceThreshold`,
      errors,
    });

    if (!bankConfig.visibleMovementTrackingEnabled) continue;

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

function validateBalanceThresholds({
  critical,
  healthy,
  criticalKey,
  healthyKey,
  errors,
}: {
  critical?: number;
  healthy?: number;
  criticalKey: string;
  healthyKey: string;
  errors: ValidationErrors;
}) {
  const criticalValue = critical ?? 0;
  const healthyValue = healthy ?? 0;

  if (!Number.isFinite(criticalValue) || criticalValue < 0) {
    errors[criticalKey] = "El saldo crítico debe ser un monto válido.";
  }

  if (!Number.isFinite(healthyValue) || healthyValue < 0) {
    errors[healthyKey] = "El saldo saludable debe ser un monto válido.";
  }

  if (
    errors[criticalKey] === undefined &&
    errors[healthyKey] === undefined &&
    healthyValue <= criticalValue
  ) {
    errors[healthyKey] =
      "El saldo saludable debe ser mayor que el saldo crítico.";
  }
}

function TrackingSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-lg border border-surface-border bg-white px-3 py-2 text-left transition hover:border-surface-border-strong"
    >
      <span>
        <span className="block text-sm font-semibold text-surface-text-primary">
          Controlar movimientos visibles
        </span>
        <span className="mt-0.5 block text-xs leading-5 text-surface-text-secondary">
          Activa alertas cuando esta cuenta se acerque al límite consultable en
          la app del banco.
        </span>
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? "bg-primary-blue" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${
            checked ? "left-5" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function toggleMovementTracking({
  bankId,
  checked,
  currentConfig,
  setDraft,
}: {
  bankId: string;
  checked: boolean;
  currentConfig: FinancialAlertConfig["banks"][string];
  setDraft: Dispatch<SetStateAction<FinancialAlertConfig>>;
}) {
  setDraft((current) => ({
    ...current,
    banks: {
      ...current.banks,
      [bankId]: {
        ...current.banks[bankId],
        visibleMovementTrackingEnabled: checked,
        visibleMovementLimit: checked
          ? (currentConfig.visibleMovementLimit ??
            DEFAULT_VISIBLE_MOVEMENT_LIMIT)
          : undefined,
        visibleMovementsUsed: checked
          ? (currentConfig.visibleMovementsUsed ?? 0)
          : undefined,
        movementWarningRemaining: checked
          ? (currentConfig.movementWarningRemaining ??
            DEFAULT_MOVEMENT_WARNING_REMAINING)
          : undefined,
      },
    },
  }));
}
