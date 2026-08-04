"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { validateCommissionRules } from "@/lib/commission";
import type {
  CommissionOperationType,
  CommissionRule,
} from "@/types/commission";
import { CommissionCoverageAlert } from "./CommissionCoverageAlert";
import { CommissionPreview } from "./CommissionPreview";
import {
  CommissionRuleDialog,
  type CommissionDialogMode,
  type CommissionRuleFormResult,
} from "./CommissionRuleDialog";
import { CommissionRulesTable } from "./CommissionRulesTable";
import { CommissionSummary } from "./CommissionSummary";
import { CommissionTabs } from "./CommissionTabs";
import { useCommissionRules } from "./CommissionRulesContext";

type DialogState = {
  mode: CommissionDialogMode;
  rule: CommissionRule | null;
} | null;

export function CommissionsPage() {
  const [operationType, setOperationType] =
    useState<CommissionOperationType>("deposito");
  const { rules, setRules } = useCommissionRules();
  const [dialogState, setDialogState] = useState<DialogState>(null);

  const scopedRules = useMemo(
    () => rules.filter((rule) => rule.operationType === operationType),
    [rules, operationType],
  );

  const validation = useMemo(() => validateCommissionRules(rules), [rules]);

  function closeDialog() {
    setDialogState(null);
  }

  function saveRule(result: CommissionRuleFormResult) {
    const currentRule = dialogState?.rule;
    const now = new Date().toISOString();

    if (dialogState?.mode === "edit" && currentRule && !currentRule.hasBeenApplied) {
      setRules((currentRules) =>
        currentRules.map((rule) =>
          rule.id === currentRule.id
            ? {
                ...rule,
                operationType: result.operationType,
                minAmountCents: result.minAmountCents,
                maxAmountCents: result.maxAmountCents,
                fixedAmountCents: result.fixedAmountCents,
                status: result.status,
                updatedBy: "Owner",
                validFrom: rule.validFrom,
              }
            : rule,
        ),
      );
      closeDialog();
      return;
    }

    const baseRule = currentRule;
    const version =
      baseRule && (dialogState?.mode === "replace" || baseRule.hasBeenApplied)
        ? baseRule.version + 1
        : Math.max(
            ...rules
              .filter((rule) => rule.operationType === result.operationType)
              .map((rule) => rule.version),
            0,
          ) + 1;
    const newRuleId = `${result.operationType}-commission-v${version}-${Date.now()}`;
    const newRule: CommissionRule = {
      id: newRuleId,
      operationType: result.operationType,
      minAmountCents: result.minAmountCents,
      maxAmountCents: result.maxAmountCents,
      calculationType: "fixed",
      fixedAmountCents: result.fixedAmountCents,
      status: result.status,
      version,
      validFrom: now,
      createdBy: "Owner",
      updatedBy: "Owner",
      hasBeenApplied: false,
    };

    setRules((currentRules) => {
      const closedRules =
        baseRule && (dialogState?.mode === "replace" || baseRule.hasBeenApplied)
          ? currentRules.map((rule) =>
              rule.id === baseRule.id
                ? {
                    ...rule,
                    status: "inactive" as const,
                    validTo: now,
                    updatedBy: "Owner",
                    replacedByRuleId: newRuleId,
                  }
                : rule,
            )
          : currentRules;

      return [...closedRules, newRule];
    });

    closeDialog();
  }

  function deactivateRule(ruleToDeactivate: CommissionRule) {
    setRules((currentRules) =>
      currentRules.map((rule) =>
        rule.id === ruleToDeactivate.id
          ? {
              ...rule,
              status: "inactive",
              validTo: new Date().toISOString(),
              updatedBy: "Owner",
            }
          : rule,
      ),
    );
  }

  function deleteRule(ruleToDelete: CommissionRule) {
    if (ruleToDelete.hasBeenApplied) {
      return;
    }

    setRules((currentRules) =>
      currentRules.filter((rule) => rule.id !== ruleToDelete.id),
    );
  }

  return (
    <div>
      <PageHeader
        title="Comisiones"
        description="Configura los importes que se cobran según el monto de cada operación."
        action={
          <button
            type="button"
            onClick={() => setDialogState({ mode: "add", rule: null })}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#1E40AF] px-4 text-sm font-semibold text-white transition hover:bg-[#1D4ED8]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Agregar rango
          </button>
        }
      />

      <div className="space-y-6">
        <CommissionCoverageAlert />

        <CommissionTabs value={operationType} onChange={setOperationType} />

        <CommissionSummary rules={rules} operationType={operationType} />

        {validation.errors.length > 0 && (
          <section className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm font-semibold text-red-800">
              Hay problemas en la configuración actual.
            </p>
            <ul className="mt-2 space-y-1 text-sm text-red-700">
              {validation.errors.map((error, index) => (
                <li key={`${error.code}-${index}`}>{error.message}</li>
              ))}
            </ul>
          </section>
        )}

        <CommissionRulesTable
          rules={scopedRules}
          onView={(rule) => setDialogState({ mode: "view", rule })}
          onEdit={(rule) =>
            setDialogState({
              mode: rule.hasBeenApplied ? "replace" : "edit",
              rule,
            })
          }
          onReplace={(rule) => setDialogState({ mode: "replace", rule })}
          onDeactivate={deactivateRule}
          onDelete={deleteRule}
        />

        <CommissionPreview rules={rules} />

        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          Los cambios de esta versión de demostración no se conservarán al
          recargar. La persistencia se habilitará con la base de datos.
        </p>
      </div>

      {dialogState && (
        <CommissionRuleDialog
          mode={dialogState.mode}
          rule={dialogState.rule}
          operationType={operationType}
          existingRules={rules}
          onClose={closeDialog}
          onSave={saveRule}
        />
      )}
    </div>
  );
}
