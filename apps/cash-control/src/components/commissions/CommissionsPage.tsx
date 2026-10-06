"use client";

import { Plus } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useBusinessFunds } from "@/components/business-funds/BusinessFundsContext";
import { useNotification } from "@/components/shared/NotificationProvider";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  hasCommissionRuleBeenApplied,
  validateCommissionRuleCandidate,
  validateCommissionRules,
} from "@/lib/commission";
import type {
  CommissionOperationType,
  CommissionRule,
} from "@/types/commission";
import { CommissionCoverageAlert } from "./CommissionCoverageAlert";
import { CommissionDeleteDialog } from "./CommissionDeleteDialog";
import { CommissionPreview } from "./CommissionPreview";
import {
  type CommissionDialogMode,
  CommissionRuleDialog,
  type CommissionRuleFormResult,
} from "./CommissionRuleDialog";
import { useCommissionRules } from "./CommissionRulesContext";
import { CommissionRulesTable } from "./CommissionRulesTable";
import { CommissionSummary } from "./CommissionSummary";
import { CommissionTabs } from "./CommissionTabs";
import { demoAppliedCommissionRuleIds } from "./commissionMockData";

type DialogState = {
  mode: CommissionDialogMode;
  rule: CommissionRule | null;
} | null;

export function CommissionsPage() {
  const { showError, showSuccess } = useNotification();
  const [operationType, setOperationType] =
    useState<CommissionOperationType>("deposito");
  const { rules, refreshRules } = useCommissionRules();
  const { operations } = useBusinessFunds();
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [ruleToDelete, setRuleToDelete] = useState<CommissionRule | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  const rulesWithUsage = useMemo(
    () =>
      rules.map((rule) => ({
        ...rule,
        hasBeenApplied:
          hasCommissionRuleBeenApplied(rule.id, operations) ||
          demoAppliedCommissionRuleIds.has(rule.id),
      })),
    [rules, operations],
  );

  const scopedRules = useMemo(
    () => rulesWithUsage.filter((rule) => rule.operationType === operationType),
    [rulesWithUsage, operationType],
  );

  const validation = useMemo(() => validateCommissionRules(rules), [rules]);

  function closeDialog() {
    setDialogState(null);
    lastTriggerRef.current?.focus();
  }

  function openDialog(nextDialogState: Exclude<DialogState, null>) {
    lastTriggerRef.current = document.activeElement as HTMLElement | null;
    setDialogState(nextDialogState);
  }

  function openDeleteDialog(rule: CommissionRule) {
    lastTriggerRef.current = document.activeElement as HTMLElement | null;
    setRuleToDelete(rule);
  }

  function closeDeleteDialog() {
    setRuleToDelete(null);
    lastTriggerRef.current?.focus();
  }

  async function saveRule(result: CommissionRuleFormResult) {
    const currentRule = dialogState?.rule;
    const now = new Date().toISOString();

    setIsSubmitting(true);
    try {
      if (
        dialogState?.mode === "edit" &&
        currentRule &&
        !currentRule.hasBeenApplied
      ) {
        const res = await fetch(`/api/commissions/${currentRule.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operationType: result.operationType,
            minAmountCents: result.minAmountCents,
            maxAmountCents: result.maxAmountCents,
            fixedAmountCents: result.fixedAmountCents,
            status: result.status,
            updatedBy: "Owner"
          })
        });
        if (!res.ok) throw new Error("Error al actualizar la regla");
        showSuccess("Regla de comisión actualizada exitosamente");
      } else {
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

        // Si hay una regla base que se reemplazará, la marcamos inactiva (sincrono o secuencial)
        if (baseRule && (dialogState?.mode === "replace" || baseRule.hasBeenApplied)) {
          await fetch(`/api/commissions/${baseRule.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: "inactive",
              validTo: now,
              updatedBy: "Owner" // ReplacedByRuleId lo omitimos por complejidad de IDs del lado del front, o se manda null 
            })
          });
        }

        const res = await fetch(`/api/commissions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operationType: result.operationType,
            minAmountCents: result.minAmountCents,
            maxAmountCents: result.maxAmountCents,
            fixedAmountCents: result.fixedAmountCents,
            status: result.status,
            version,
            validFrom: now,
            createdBy: "Owner",
            hasBeenApplied: false,
          })
        });
        if (!res.ok) throw new Error("Error al crear la nueva regla");
        showSuccess("Nueva regla creada correctamente");
      }

      await refreshRules();
      closeDialog();
    } catch (error) {
      showError("Ocurrió un error al guardar la comisión");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deactivateRule(ruleToDeactivate: CommissionRule) {
    try {
      const res = await fetch(`/api/commissions/${ruleToDeactivate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "inactive",
          validTo: new Date().toISOString(),
          updatedBy: "Owner"
        })
      });
      if (!res.ok) throw new Error();
      await refreshRules();
      showSuccess("Regla desactivada exitosamente");
    } catch (e) {
      showError("No se pudo desactivar la regla");
    }
  }

  async function activateRule(ruleToActivate: CommissionRule) {
    const validationResult = validateCommissionRuleCandidate(
      {
        id: ruleToActivate.id,
        operationType: ruleToActivate.operationType,
        minAmountCents: ruleToActivate.minAmountCents,
        maxAmountCents: ruleToActivate.maxAmountCents,
        calculationType: "fixed",
        fixedAmountCents: ruleToActivate.fixedAmountCents,
        status: "active",
      },
      rules,
    );

    if (validationResult.errors.length > 0) {
      showError("Conflictos en los límites impiden la activación");
      return;
    }

    try {
      const res = await fetch(`/api/commissions/${ruleToActivate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "active",
          validTo: null,
          updatedBy: "Owner"
        })
      });
      if (!res.ok) throw new Error();
      await refreshRules();
      showSuccess("Regla activada de vuelta");
    } catch (e) {
      showError("No se pudo activar la regla");
    }
  }

  async function confirmDeleteRule() {
    if (!ruleToDelete || ruleToDelete.hasBeenApplied || ruleToDelete.replacedByRuleId) {
      return;
    }

    try {
      const res = await fetch(`/api/commissions/${ruleToDelete.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      await refreshRules();
      showSuccess("Regla eliminada exitosamente");
    } catch (e) {
      showError("No se pudo eliminar la regla");
    } finally {
      closeDeleteDialog();
    }
  }

  return (
    <div>
      <PageHeader
        title="Comisiones"
        description="Configura los importes que se cobran según el monto de cada operación."
        action={
          <button
            type="button"
            onClick={() => openDialog({ mode: "add", rule: null })}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#2563EB] px-4 text-sm font-semibold text-white transition hover:bg-[#1D4ED8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#93C5FD] focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Agregar rango
          </button>
        }
      />

      <div className="space-y-6">
        <CommissionCoverageAlert
          warnings={validation.warnings}
          currentOperationType={operationType}
        />

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
          onView={(rule) => openDialog({ mode: "view", rule })}
          onEdit={(rule) =>
            openDialog({
              mode: rule.hasBeenApplied ? "replace" : "edit",
              rule,
            })
          }
          onReplace={(rule) => openDialog({ mode: "replace", rule })}
          onDeactivate={deactivateRule}
          onActivate={activateRule}
          onDelete={openDeleteDialog}
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

      {ruleToDelete && (
        <CommissionDeleteDialog
          rule={ruleToDelete}
          onCancel={closeDeleteDialog}
          onConfirm={confirmDeleteRule}
        />
      )}
    </div>
  );
}
