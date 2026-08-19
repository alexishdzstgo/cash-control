"use client";

import { useEffect } from "react";
import { ModalShell } from "@/components/shared/ModalShell";
import { formatCents } from "@/lib/commission";
import type { CommissionRule } from "@/types/commission";

type CommissionDeleteDialogProps = {
  rule: CommissionRule;
  onCancel: () => void;
  onConfirm: () => void;
};

export function CommissionDeleteDialog({
  rule,
  onCancel,
  onConfirm,
}: CommissionDeleteDialogProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <ModalShell
      title="Eliminar rango de comision"
      description={
        <>
          {formatCents(rule.minAmountCents)} -{" "}
          {rule.maxAmountCents === null
            ? "Sin limite"
            : formatCents(rule.maxAmountCents)}
        </>
      }
      onClose={onCancel}
      closeOnOverlayClick
      maxWidth="md"
      footer={
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="btn-secondary">
            Volver
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-[#DC2626] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#B91C1C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2"
          >
            Eliminar rango
          </button>
        </div>
      }
    >
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm leading-6 text-slate-600">
          Esta accion eliminara el rango de la configuracion actual. No podras
          recuperarlo despues de confirmar.
        </p>
      </div>
    </ModalShell>
  );
}
