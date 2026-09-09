"use client";

import { UserAvatar } from "@/components/shared/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import type { ShiftViewModel } from "@/types/shift";

interface ActiveShiftCardProps {
  shift: ShiftViewModel;
  onViewDetails: () => void;
  onManageParticipants: () => void;
}

export function ActiveShiftCard({
  shift,
  onViewDetails,
  onManageParticipants,
}: ActiveShiftCardProps) {
  const responsible = shift.participants.find(
    (p) => p.userId === shift.responsibleUserId,
  );
  const activeParticipants = shift.participants.filter(
    (p) => p.status === "active",
  );

  return (
    <div className="rounded-xl border border-brand-border bg-white p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900">Turno actual</h2>
            <Badge variant={shift.status === "open" ? "success" : "neutral"}>
              {shift.status === "open" ? "Abierto" : "Cerrado"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Iniciado el{" "}
            {new Date(shift.openedAt).toLocaleDateString("es-MX", {
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
          {responsible ? (
            <div className="mt-2 flex items-center gap-2">
              <UserAvatar
                name={responsible.name}
                avatar={responsible.avatar}
                size="sm"
              />
              <p className="min-w-0 truncate text-sm font-medium text-slate-900">
                {responsible.name}
              </p>
            </div>
          ) : (
            <p className="mt-1 text-sm font-medium text-slate-900">
              Sin asignar
            </p>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-100/50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Folio
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {shift.folio}
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
            Caja física al abrir
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900 tabular-nums">
            {formatCurrency(shift.openingBalances.cashPhysical)}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button variant="outline" onClick={onViewDetails}>
          Ver detalles
        </Button>
        <Button variant="outline" onClick={onManageParticipants}>
          Administrar participantes
        </Button>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Las acciones de este módulo son una simulación local y se reinician al
        recargar.
      </p>
    </div>
  );
}
