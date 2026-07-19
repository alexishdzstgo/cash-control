"use client";

import { CheckCircle2, Clock3 } from "lucide-react";

type DepositSubmissionActionsProps = {
  disabled?: boolean;
  onRegisterAndDeliver: () => void;
  onRegisterWithoutDelivering: () => void;
};

export function DepositSubmissionActions({
  disabled = false,
  onRegisterAndDeliver,
  onRegisterWithoutDelivering,
}: DepositSubmissionActionsProps) {
  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={disabled}
        onClick={onRegisterAndDeliver}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <CheckCircle2 className="h-5 w-5" />
        Registrar y entregar
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={onRegisterWithoutDelivering}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 transition hover:border-amber-300 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Clock3 className="h-5 w-5" />
        Registrar sin entregar
      </button>

      <p className="text-center text-xs leading-5 text-slate-500">
        Usa “Registrar sin entregar” cuando el depósito todavía no pueda
        verificarse o pagarse al cliente.
      </p>
    </div>
  );
}