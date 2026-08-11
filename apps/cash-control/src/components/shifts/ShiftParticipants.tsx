"use client";

import { Button } from "@/components/ui/button";
import type { Shift, ShiftParticipant } from "@/types/shift";
import { ShiftParticipantCard } from "./ShiftParticipantCard";

interface ShiftParticipantsProps {
  shift: Shift;
  canAddParticipants: boolean;
  canRemoveParticipants: boolean;
  canTransferResponsibility: boolean;
  onAddParticipant: () => void;
  onRemoveParticipant: (participantId: string) => void;
  onTransferResponsibility: (participant: ShiftParticipant) => void;
}

export function ShiftParticipants({
  shift,
  canAddParticipants,
  canRemoveParticipants,
  canTransferResponsibility,
  onAddParticipant,
  onRemoveParticipant,
  onTransferResponsibility,
}: ShiftParticipantsProps) {
  const activeParticipants = shift.participants.filter(
    (p) => p.status === "active",
  );
  const leftParticipants = shift.participants.filter(
    (p) => p.status === "left",
  );

  return (
    <div className="rounded-xl border border-brand-border bg-white p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Participantes
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {activeParticipants.length} activo
            {activeParticipants.length !== 1 ? "s" : ""}
            {leftParticipants.length > 0 &&
              ` · ${leftParticipants.length} retirado${leftParticipants.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        {canAddParticipants && (
          <Button variant="outline" onClick={onAddParticipant}>
            Agregar participante
          </Button>
        )}
      </div>

      {activeParticipants.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 p-8 text-center">
          <p className="text-sm text-slate-500">
            No hay participantes activos en este turno.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {activeParticipants.map((participant) => (
            <ShiftParticipantCard
              key={participant.id}
              participant={participant}
              isResponsible={participant.userId === shift.responsibleUserId}
              canRemove={
                canRemoveParticipants &&
                participant.userId !== shift.responsibleUserId
              }
              canReceiveResponsibility={
                canTransferResponsibility &&
                participant.status === "active" &&
                participant.userId !== shift.responsibleUserId
              }
              onRemove={() => onRemoveParticipant(participant.id)}
              onTransfer={() => onTransferResponsibility(participant)}
            />
          ))}
        </div>
      )}

      {leftParticipants.length > 0 && (
        <div className="mt-6">
          <h4 className="mb-3 text-sm font-medium text-slate-500">
            Participantes retirados
          </h4>
          <div className="space-y-3">
            {leftParticipants.map((participant) => (
              <ShiftParticipantCard
                key={participant.id}
                participant={participant}
                isResponsible={false}
                canRemove={false}
                canReceiveResponsibility={false}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
