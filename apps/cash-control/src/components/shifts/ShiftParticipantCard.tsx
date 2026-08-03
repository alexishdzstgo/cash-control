"use client";

import type { ShiftParticipant } from "@/types/shift";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, UserRoundCheck, UserRound, UserX } from "lucide-react";

interface ShiftParticipantCardProps {
  participant: ShiftParticipant;
  isResponsible: boolean;
  canRemove: boolean;
  canReceiveResponsibility: boolean;
  onRemove?: () => void;
  onTransfer?: () => void;
}

const systemRoleLabels: Record<string, string> = {
  owner: "Dueño",
  employee: "Empleado",
};

const shiftRoleLabels: Record<string, string> = {
  shift_responsible: "Responsable del turno",
  operator: "Operador",
};

const systemRoleBadgeVariants: Record<string, "brand" | "neutral"> = {
  owner: "brand",
  employee: "neutral",
};

const shiftRoleBadgeVariants: Record<string, "info" | "neutral"> = {
  shift_responsible: "info",
  operator: "neutral",
};

export function ShiftParticipantCard({
  participant,
  isResponsible,
  canRemove,
  canReceiveResponsibility,
  onRemove,
  onTransfer,
}: ShiftParticipantCardProps) {
  const joinedAt = new Date(participant.joinedAt).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const showActions = !isResponsible && (canRemove || canReceiveResponsibility);

  return (
    <div className="rounded-xl border border-brand-border bg-white p-4 transition-colors hover:border-slate-300">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-primary-soft text-brand-primary">
              <UserRound className="h-5 w-5" />
            </div>
            <h4 className="font-medium text-slate-900">{participant.name}</h4>
            {isResponsible && (
              <Badge variant="brand">
                <ShieldCheck className="h-3.5 w-3.5" />
                Responsable actual
              </Badge>
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant={systemRoleBadgeVariants[participant.systemRole] ?? "neutral"}>
              {systemRoleLabels[participant.systemRole]}
            </Badge>
            <Badge variant={shiftRoleBadgeVariants[participant.shiftRole] ?? "neutral"}>
              {shiftRoleLabels[participant.shiftRole]}
            </Badge>
          </div>

          <p className="mt-2 text-xs text-slate-500">
            Incorporado a las {joinedAt}
          </p>
        </div>

        {showActions && (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {canReceiveResponsibility && onTransfer && (
              <Button
                variant="outline"
                size="sm"
                onClick={onTransfer}
                className="w-full sm:w-auto"
              >
                <UserRoundCheck className="mr-1.5 h-4 w-4 text-violet-600" />
                Entregar responsabilidad
              </Button>
            )}
            {canRemove && onRemove && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRemove}
                className="w-full text-red-600 hover:bg-red-50 hover:text-red-700 sm:w-auto"
              >
                <UserX className="mr-1.5 h-4 w-4" />
                Retirar del turno
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}