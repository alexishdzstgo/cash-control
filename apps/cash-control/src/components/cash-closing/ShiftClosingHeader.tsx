"use client";

import { Clock, User, Calendar, Timer } from "lucide-react";
import type { CashClosingShift } from "@/types/cash-closing";

type ShiftClosingHeaderProps = {
  shift: CashClosingShift;
};

export function ShiftClosingHeader({ shift }: ShiftClosingHeaderProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{shift.name}</h2>
          <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Turno activo
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <User className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="min-w-0 break-words">
            <span className="font-medium text-slate-500">Responsable:</span>{" "}
            {shift.responsibleName}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Clock className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="min-w-0 break-words">
            <span className="font-medium text-slate-500">Inicio:</span>{" "}
            {shift.startedAt}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="min-w-0 break-words">
            <span className="font-medium text-slate-500">Fin programado:</span>{" "}
            {shift.scheduledEndAt}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Timer className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="min-w-0 break-words">
            <span className="font-medium text-slate-500">Duración:</span>{" "}
            {shift.currentDuration}
          </span>
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Esta es una vista de prueba. El cierre real del turno se implementará
        posteriormente.
      </p>
    </div>
  );
}