"use client";

import type { Shift } from "@/types/shift";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ActiveShiftCardProps {
  shift: Shift;
  onViewDetails: () => void;
  onManageParticipants: () => void;
  onTransferResponsibility: () => void;
  onStartClosing: () => void;
}

export function ActiveShiftCard({
  shift,
  onViewDetails,
  onManageParticipants,
  onTransferResponsibility,
  onStartClosing,
}: ActiveShiftCardProps) {
  const responsible = shift.participants.find((p) => p.userId === shift.responsibleUserId);
  const activeParticipants = shift.participants.filter((p) => p.status === "active");

  return (
    <div className="rounded-xl border border-brand-border bg-white p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900">{shift.name}</h2>
            <Badge variant="success">Activo</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Iniciado el {new Date(shift.startedAt).toLocaleDateString("es-MX", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-slate-100/50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Responsable
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {responsible?.name ?? "Sin asignar"}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-100/50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Duración
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {shift.currentDuration ?? "—"}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-100/50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Participantes activos
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {activeParticipants.length}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-100/50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Saldo inicial
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900 tabular-nums">
            ${shift.openingBalance.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button variant="default" onClick={onStartClosing}>
          Iniciar cierre
        </Button>
        <Button variant="outline" onClick={onViewDetails}>
          Ver detalles
        </Button>
        <Button variant="outline" onClick={onManageParticipants}>
          Administrar participantes
        </Button>
        <Button variant="outline" onClick={onTransferResponsibility}>
          Transferir responsabilidad
        </Button>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Las acciones de este módulo son una simulación local y se reinician al recargar.
      </p>
    </div>
  );
}
