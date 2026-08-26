"use client";

import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import type { Shift } from "@/types/shift";

interface ShiftHistoryProps {
  shifts: Shift[];
}

const statusLabels: Record<
  string,
  { label: string; variant: "neutral" | "alert" }
> = {
  closed: {
    label: "Cerrado",
    variant: "neutral",
  },
  closed_review_required: {
    label: "Requiere revisión",
    variant: "alert",
  },
};

const resultLabels: Record<string, string> = {
  balanced: "Caja cuadrada",
  shortage: `Faltante`,
  surplus: "Sobrante",
};

export function ShiftHistory({ shifts }: ShiftHistoryProps) {
  if (shifts.length === 0) {
    return (
      <div className="rounded-xl border border-brand-border bg-white p-6">
        <h3 className="text-lg font-semibold text-slate-900">
          Historial de turnos
        </h3>
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 p-8 text-center">
          <p className="text-sm text-slate-500">
            Todavía no hay turnos anteriores.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-brand-border bg-white p-6">
      <h3 className="text-lg font-semibold text-slate-900">
        Historial de turnos
      </h3>

      {/* Desktop table */}
      <div className="mt-4 hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th className="pb-3 font-medium">Turno</th>
              <th className="pb-3 font-medium">Responsable final</th>
              <th className="pb-3 font-medium">Inicio</th>
              <th className="pb-3 font-medium">Cierre</th>
              <th className="pb-3 font-medium">Duración</th>
              <th className="pb-3 font-medium">Resultado</th>
              <th className="pb-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {shifts.map((shift) => {
              const responsible = shift.participants.find(
                (p) => p.userId === shift.responsibleUserId,
              );
              const statusInfo =
                statusLabels[shift.status] ?? statusLabels.closed;
              const resultText = shift.closingResult
                ? `${resultLabels[shift.closingResult] ?? shift.closingResult}${shift.closingDifference !== undefined && shift.closingDifference !== 0 ? ` de ${formatCurrency(Math.abs(shift.closingDifference))}` : ""}`
                : "—";

              return (
                <tr key={shift.id} className="text-slate-600">
                  <td className="py-3 font-medium text-slate-900">
                    {shift.name}
                  </td>
                  <td className="py-3">
                    <div>
                      <p className="text-slate-900">
                        {responsible?.name ?? "Sin asignar"}
                      </p>
                      {responsible && responsible.systemRole === "owner" && (
                        <p className="text-xs text-slate-500">Dueño</p>
                      )}
                    </div>
                  </td>
                  <td className="py-3 text-slate-600">
                    {new Date(shift.startedAt).toLocaleString("es-MX", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="py-3 text-slate-600">
                    {shift.endedAt
                      ? new Date(shift.endedAt).toLocaleString("es-MX", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td className="py-3 text-slate-600">
                    {shift.currentDuration ?? "—"}
                  </td>
                  <td className="py-3 text-slate-600">{resultText}</td>
                  <td className="py-3">
                    <Badge variant={statusInfo.variant}>
                      {statusInfo.label}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="mt-4 space-y-3 md:hidden">
        {shifts.map((shift) => {
          const responsible = shift.participants.find(
            (p) => p.userId === shift.responsibleUserId,
          );
          const statusInfo = statusLabels[shift.status] ?? statusLabels.closed;
          const resultText = shift.closingResult
            ? `${resultLabels[shift.closingResult] ?? shift.closingResult}${shift.closingDifference !== undefined && shift.closingDifference !== 0 ? ` de ${formatCurrency(Math.abs(shift.closingDifference))}` : ""}`
            : "—";

          return (
            <div
              key={shift.id}
              className="rounded-lg border border-slate-200 bg-slate-50/50 p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-slate-900">{shift.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Responsable: {responsible?.name ?? "Sin asignar"}
                  </p>
                </div>
                <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                <div>
                  <p className="text-slate-400">Inicio</p>
                  <p className="text-slate-700">
                    {new Date(shift.startedAt).toLocaleString("es-MX", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Cierre</p>
                  <p className="text-slate-700">
                    {shift.endedAt
                      ? new Date(shift.endedAt).toLocaleString("es-MX", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Duración</p>
                  <p className="text-slate-700">
                    {shift.currentDuration ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Resultado</p>
                  <p className="text-slate-700">{resultText}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
