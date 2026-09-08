"use client";

import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/formatters";
import { formatShiftDuration } from "@/lib/shifts";
import type { Shift } from "@/types/shift";

export function ShiftHistory({ shifts }: { shifts: Shift[] }) {
  return (
    <section className="rounded-xl border border-brand-border bg-white p-6">
      <h3 className="text-lg font-semibold text-slate-900">
        Historial de turnos
      </h3>
      {shifts.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 p-8 text-center">
          <p className="text-sm text-slate-500">Aún no hay turnos cerrados.</p>
        </div>
      ) : (
        <>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  {[
                    "Turno",
                    "Responsable final",
                    "Inicio",
                    "Cierre",
                    "Duración",
                    "Estado",
                  ].map((label) => (
                    <th key={label} className="pb-3 font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {shifts.map((shift) => (
                  <tr key={shift.id} className="text-slate-600">
                    <td className="py-3 font-medium text-slate-900">
                      {shift.folio}
                    </td>
                    <td className="py-3">
                      {shift.responsibleUserName || "Sin asignar"}
                    </td>
                    <td className="py-3">{formatDateTime(shift.openedAt)}</td>
                    <td className="py-3">
                      {shift.closedAt ? formatDateTime(shift.closedAt) : "—"}
                    </td>
                    <td className="py-3">
                      {shift.closedAt
                        ? formatShiftDuration(shift.openedAt, shift.closedAt)
                        : "—"}
                    </td>
                    <td className="py-3">
                      <Badge variant="neutral">Cerrado</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 space-y-3 md:hidden">
            {shifts.map((shift) => (
              <div
                key={shift.id}
                className="rounded-lg border border-slate-200 bg-slate-50/50 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-slate-900">{shift.folio}</p>
                  <Badge variant="neutral">Cerrado</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Responsable: {shift.responsibleUserName || "Sin asignar"}
                </p>
                <p className="mt-3 text-xs text-slate-600">
                  Inicio: {formatDateTime(shift.openedAt)}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Cierre:{" "}
                  {shift.closedAt ? formatDateTime(shift.closedAt) : "—"}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
