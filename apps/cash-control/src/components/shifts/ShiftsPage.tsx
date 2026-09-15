"use client";

import { useMemo, useState } from "react";
import { useBusinessFunds } from "@/components/business-funds/BusinessFundsContext";
import { EndParticipationModal } from "@/components/participation/EndParticipationModal";
import { TransferResponsibilityModal } from "@/components/participation/TransferResponsibilityModal";
import { PageHeader } from "@/components/shared/PageHeader";
import { useUsers } from "@/components/users/UsersContext";
import { useOptionalRealWorkstationSession } from "@/components/workstation/RealWorkstationSessionProvider";
import type { Participant } from "@/components/workstation/types";
import { getShiftActivity, getShiftActivitySummary } from "@/lib/shiftActivity";
import { buildTransferSummary } from "@/lib/transferSummary";
import type { ShiftParticipant, ShiftViewModel } from "@/types/shift";
import { ActiveShiftCard } from "./ActiveShiftCard";
import { AddParticipantModal } from "./AddParticipantModal";
import { ShiftActivitySummary } from "./ShiftActivitySummary";
import { ShiftActivityTimeline } from "./ShiftActivityTimeline";
import { useShift } from "./ShiftContext";
import { ShiftDetailsModal } from "./ShiftDetailsModal";
import { ShiftHistory } from "./ShiftHistory";
import { ShiftParticipants } from "./ShiftParticipants";
import { StartShiftModal } from "./StartShiftModal";

function toLegacyParticipants(participants: ShiftParticipant[]): Participant[] {
  return participants.map((participant) => ({
    id: participant.id,
    userId: participant.userId,
    userName: participant.name,
    participationType:
      participant.shiftRole === "shift_responsible" ? "responsible" : "support",
    status: participant.status === "active" ? "active" : "ended",
    startedAt: new Date(participant.joinedAt).toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    ...(participant.leftAt
      ? { endedAt: new Date(participant.leftAt).toLocaleTimeString("es-MX") }
      : {}),
  }));
}

export function ShiftsPage() {
  const {
    currentShift,
    shifts,
    participants,
    loading,
    error,
    isMutating,
    canStartShift,
    canAddParticipant,
    canLeaveShift,
    isCurrentUserParticipant,
    isCurrentUserResponsible,
    addParticipant,
    transferResponsibility,
    leaveShift,
  } = useShift();
  const realWorkstationSession = useOptionalRealWorkstationSession();
  const { users } = useUsers();
  const { cash, banks, operations, movements } = useBusinessFunds();

  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState("");
  const [selectedTransferParticipant, setSelectedTransferParticipant] =
    useState<ShiftParticipant | null>(null);
  const [transferPin, setTransferPin] = useState("");
  const [transferError, setTransferError] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);

  const displayParticipants = useMemo(
    () =>
      participants.map((participant) => ({
        ...participant,
        systemRole:
          realWorkstationSession?.activatedMembers.find(
            (member) => member.memberId === participant.userId,
          )?.role ??
          users.find((user) => user.id === participant.userId)?.systemRole ??
          participant.systemRole,
      })),
    [participants, realWorkstationSession?.activatedMembers, users],
  );

  const activeParticipantIds = useMemo(
    () =>
      new Set(
        participants
          .filter((participant) => participant.status === "active")
          .map((participant) => participant.userId),
      ),
    [participants],
  );

  const availableUsers = useMemo(() => {
    if (realWorkstationSession) {
      return realWorkstationSession.activatedMembers
        .filter((member) => !activeParticipantIds.has(member.memberId))
        .map((member) => ({
          userId: member.memberId,
          name: member.displayName,
          systemRole: member.role,
          avatar: undefined,
        }));
    }
    return users
      .filter(
        (user) =>
          user.status === "active" && !activeParticipantIds.has(user.id),
      )
      .map((user) => ({
        userId: user.id,
        name: user.displayName,
        systemRole: user.systemRole,
        avatar: undefined,
      }));
  }, [activeParticipantIds, realWorkstationSession, users]);

  const closedShifts = shifts
    .filter((shift) => shift.status === "closed")
    .reverse()
    .sort(
      (a, b) =>
        (b.closedAt ?? "").localeCompare(a.closedAt ?? "") ||
        b.openedAt.localeCompare(a.openedAt),
    );

  const derivedShift = useMemo<ShiftViewModel | null>(
    () =>
      currentShift
        ? {
            ...currentShift,
            participants: displayParticipants,
            summary: getShiftActivitySummary(
              currentShift.id,
              operations,
              movements,
            ),
            activity: getShiftActivity(currentShift, operations, movements),
          }
        : null,
    [currentShift, displayParticipants, movements, operations],
  );

  const transferSummary = useMemo(
    () =>
      selectedTransferParticipant
        ? buildTransferSummary({
            currentShift,
            cash,
            banks,
            operations,
            participants: toLegacyParticipants(participants),
          })
        : null,
    [
      banks,
      cash,
      currentShift,
      operations,
      participants,
      selectedTransferParticipant,
    ],
  );

  async function handleAddParticipant(user: {
    userId: string;
    name: string;
    systemRole: "owner" | "employee";
  }) {
    const result = await addParticipant(user.userId);
    if (!result.success) return;
    setIsAddModalOpen(false);
  }

  function openTransfer(participant: ShiftParticipant) {
    setSelectedTransferParticipant(participant);
    setTransferPin("");
    setTransferError("");
  }

  function closeTransfer() {
    if (isTransferring) return;
    setSelectedTransferParticipant(null);
    setTransferPin("");
    setTransferError("");
  }

  function finishTransfer(result: { success: boolean; error?: string }) {
    setTransferPin("");
    if (result.success) {
      setSelectedTransferParticipant(null);
      setTransferError("");
    } else {
      setTransferError(
        result.error ?? "No se pudo transferir la responsabilidad.",
      );
    }
    setIsTransferring(false);
  }

  function handleTransferConfirm() {
    if (!selectedTransferParticipant) return;
    setIsTransferring(true);
    const result = transferResponsibility(
      selectedTransferParticipant.userId,
      transferPin,
    );
    if (result instanceof Promise) {
      void result.then(finishTransfer);
      return;
    }
    finishTransfer(result);
  }

  async function handleLeaveConfirm() {
    setIsLeaving(true);
    const result = await leaveShift();
    if (result.success) {
      setIsLeaveModalOpen(false);
      setLeaveError("");
    } else {
      setLeaveError(result.error ?? "No se pudo finalizar la participación.");
    }
    setIsLeaving(false);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Turno actual"
          description="Consulta el turno activo y el historial de jornadas."
        />
        <section className="rounded-xl border border-brand-border bg-white p-6">
          <p className="text-sm text-slate-600">Consultando el turno actual…</p>
        </section>
      </div>
    );
  }

  if (error && !derivedShift) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Turno actual"
          description="Consulta el turno activo y el historial de jornadas."
        />
        <section className="rounded-xl border border-red-200 bg-white p-6">
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        </section>
      </div>
    );
  }

  if (!derivedShift) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Turno actual"
          description="Consulta el turno activo y el historial de jornadas."
        />
        <section className="rounded-xl border border-brand-border bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            No hay un turno abierto
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Las operaciones permanecerán bloqueadas hasta que el operador actual
            inicie un nuevo turno.
          </p>
          {canStartShift() ? (
            <button
              type="button"
              className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              onClick={() => setIsStartModalOpen(true)}
              disabled={isMutating}
            >
              Iniciar nuevo turno
            </button>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              No hay un operador disponible para iniciar el turno.
            </p>
          )}
        </section>
        <ShiftHistory shifts={closedShifts} />
        {isStartModalOpen && (
          <StartShiftModal
            cash={cash}
            banks={banks}
            onClose={() => setIsStartModalOpen(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Turnos"
        description="Consulta el turno activo, sus participantes y el historial de jornadas."
      />

      {error && (
        <p role="alert" className="mb-4 text-sm text-red-700">
          {error}
        </p>
      )}
      {leaveError && (
        <p role="alert" className="mb-4 text-sm text-red-700">
          {leaveError}
        </p>
      )}

      <div className="mt-6 space-y-6">
        <ActiveShiftCard
          shift={derivedShift}
          onViewDetails={() => setIsDetailsModalOpen(true)}
          onManageParticipants={() => {
            document
              .getElementById("participants-section")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
        />

        <ShiftActivitySummary summary={derivedShift.summary} />

        {!isCurrentUserParticipant() && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Este operador todavía no participa en el turno. El responsable o
            propietario debe agregarlo como participante.
          </p>
        )}

        <div
          id="participants-section"
          className="grid grid-cols-1 gap-6 lg:grid-cols-2"
        >
          <ShiftParticipants
            shift={derivedShift}
            canAddParticipants={canAddParticipant()}
            canRemoveParticipants={false}
            canTransferResponsibility={isCurrentUserResponsible()}
            canLeaveCurrentUser={canLeaveShift()}
            onAddParticipant={() => setIsAddModalOpen(true)}
            onRemoveParticipant={() => undefined}
            onTransferResponsibility={openTransfer}
            onLeaveCurrentUser={() => {
              setLeaveError("");
              setIsLeaveModalOpen(true);
            }}
          />

          <ShiftActivityTimeline
            activities={derivedShift.activity}
            folio={derivedShift.folio}
          />
        </div>

        <ShiftHistory shifts={closedShifts} />
      </div>

      <AddParticipantModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        availableUsers={availableUsers}
        onAdd={handleAddParticipant}
      />

      {selectedTransferParticipant && (
        <TransferResponsibilityModal
          isEnding={isTransferring}
          selectedParticipant={{
            userId: selectedTransferParticipant.userId,
            userName: selectedTransferParticipant.name,
          }}
          transferSummary={transferSummary}
          transferPin={transferPin}
          transferError={transferError}
          onClose={closeTransfer}
          onPinChange={setTransferPin}
          onConfirm={handleTransferConfirm}
        />
      )}

      {isLeaveModalOpen && (
        <EndParticipationModal
          isEnding={isLeaving}
          onClose={() => setIsLeaveModalOpen(false)}
          onConfirm={handleLeaveConfirm}
        />
      )}

      <ShiftDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        shift={derivedShift}
      />
    </div>
  );
}
