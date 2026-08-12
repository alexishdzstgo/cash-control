"use client";

import { UserRound } from "lucide-react";
import type { CashClosingShift } from "@/types/cash-closing";

type ShiftClosingHeaderProps = {
  shift: CashClosingShift;
};

export function ShiftClosingHeader({ shift }: ShiftClosingHeaderProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Corte actual</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Revisa los movimientos registrados antes de realizar el conteo
            físico.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <UserRound className="h-4 w-4 shrink-0 text-slate-400" />
          <span>
            <span className="font-medium text-slate-500">Realizado por:</span>{" "}
            {shift.responsibleName}
          </span>
        </div>
      </div>
    </div>
  );
}
