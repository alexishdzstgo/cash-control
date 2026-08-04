"use client";

import { useMemo, useState } from "react";
import {
  calculateCommission,
  formatCents,
  NO_COMMISSION_RULE_MESSAGE,
  parseCurrencyToCents,
} from "@/lib/commission";
import type {
  CommissionOperationType,
  CommissionRule,
} from "@/types/commission";

type CommissionPreviewProps = {
  rules: CommissionRule[];
};

export function CommissionPreview({ rules }: CommissionPreviewProps) {
  const [operationType, setOperationType] =
    useState<CommissionOperationType>("deposito");
  const [amount, setAmount] = useState("50.50");

  const result = useMemo(() => {
    const amountCents = parseCurrencyToCents(amount);
    if (amountCents === null) {
      return { amountCents, calculation: null, error: "Captura un monto válido." };
    }

    try {
      return {
        amountCents,
        calculation: calculateCommission({
          amountCents,
          operationType,
          rules,
        }),
        error: null,
      };
    } catch (error) {
      return {
        amountCents,
        calculation: null,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo calcular la comisión.",
      };
    }
  }, [amount, operationType, rules]);

  const appliedRule = result.calculation
    ? rules.find((rule) => rule.id === result.calculation?.ruleId)
    : null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-950">
          Probar una comisión
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Verifica límites exactos y montos fuera de cobertura.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Tipo
          </label>
          <select
            value={operationType}
            onChange={(event) =>
              setOperationType(event.target.value as CommissionOperationType)
            }
            className={inputClass}
          >
            <option value="deposito">Depósito</option>
            <option value="retiro">Retiro</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Monto
          </label>
          <input
            type="text"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className={inputClass}
            placeholder="50.50"
          />
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
        {result.calculation && result.amountCents !== null ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <PreviewItem
              label="Comisión calculada"
              value={formatCents(result.calculation.commissionAmountCents)}
            />
            <PreviewItem
              label="Monto total"
              value={formatCents(
                result.amountCents + result.calculation.commissionAmountCents,
              )}
            />
            <PreviewItem
              label="Rango aplicado"
              value={
                appliedRule
                  ? `${formatCents(appliedRule.minAmountCents)} - ${
                      appliedRule.maxAmountCents === null
                        ? "Sin límite"
                        : formatCents(appliedRule.maxAmountCents)
                    }`
                  : "No disponible"
              }
            />
            <PreviewItem
              label="Versión"
              value={`v${result.calculation.ruleVersion}`}
            />
          </div>
        ) : (
          <p className="text-sm font-medium text-amber-800">
            {result.error ?? NO_COMMISSION_RULE_MESSAGE}
          </p>
        )}
      </div>
    </section>
  );
}

function PreviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900 tabular-nums">
        {value}
      </p>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 font-sans text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100";
