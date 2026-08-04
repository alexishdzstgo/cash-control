"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useRef } from "react";
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
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4"
      onClick={onCancel}
    >
      <div
        className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="shrink-0 border-b border-slate-100 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                ref={titleRef}
                tabIndex={-1}
                className="text-lg font-bold text-slate-900 outline-none"
              >
                Eliminar rango de comisión
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {formatCents(rule.minAmountCents)} -{" "}
                {rule.maxAmountCents === null
                  ? "Sin límite"
                  : formatCents(rule.maxAmountCents)}
              </p>
            </div>
          </div>
        </header>

        <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <p className="text-sm leading-6 text-slate-600">
            Esta acción eliminará el rango de la configuración actual. No
            podrás recuperarlo después de confirmar.
          </p>
        </div>

        <footer className="flex shrink-0 justify-end gap-3 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-[#CBD5E1] bg-white px-4 py-2 text-sm font-semibold text-[#334155] transition hover:bg-[#F1F5F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#93C5FD] focus-visible:ring-offset-2"
          >
            Volver
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-[#DC2626] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#B91C1C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2"
          >
            Eliminar rango
          </button>
        </footer>
      </div>
    </div>
  );
}
