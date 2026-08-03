"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ActiveShiftCard } from "./ActiveShiftCard";
import { ShiftParticipants } from "./ShiftParticipants";
import { ShiftActivityTimeline } from "./ShiftActivityTimeline";
import { ShiftHistory } from "./ShiftHistory";
import { AddParticipantModal } from "./AddParticipantModal";
import { RemoveParticipantDialog } from "./RemoveParticipantDialog";
import { ShiftDetailsModal } from "./ShiftDetailsModal";
import { useMockSession } from "@/components/session/MockSessionContext";
import { mockRegisteredUsers } from "@/components/workstation/mockData";
import type { Participant } from "@/components/workstation/types";
import { useResponsibilityTransfer } from "@/components/participation/useResponsibilityTransfer";
import { TransferResponsibilityModal } from "@/components/participation/TransferResponsibilityModal";
import { mockShifts } from "./shiftsMockData";
import type { Shift, ShiftParticipant } from "@/types/shift";

/**
 * Maps a systemRole from the workstation types to the shift types.
 */
const systemRoleToShiftRole = (role: string): "owner" | "employee" => {
  if (role === "owner" || role === "employee") {
    return role as "owner" | "employee";
  }
  return "employee";
};

/**
 * Transforms a context Participant (workstation/types) into a ShiftParticipant (types/shift)
 * for rendering in the shift UI.
 */
function participantToShiftParticipant(p: Participant): ShiftParticipant {
  return {
    id: p.id,
    userId: p.userId,
    name: p.userName,
    systemRole: systemRoleToShiftRole(
      mockRegisteredUsers.find((u) => u.userId === p.userId)?.systemRole ?? "employee"
    ),
    shiftRole: p.participationType === "responsible" ? "shift_responsible" : "operator",
    joinedAt: (() => {
      const now = new Date();
      const [hours, minutes] = p.startedAt.split(":").map(Number);
      now.setHours(hours, minutes, 0, 0);
      return now.toISOString();
    })(),
    status: p.status === "active" ? "active" : "left",
  };
}

/**
 * Determines which registered users are available to be added as participants.
 * A user is available if they do NOT have an active participation in the context.
 */
function getAvailableUsers(contextParticipants: Participant[]) {
  const activeUserIds = new Set(
    contextParticipants
      .filter((p) => p.status === "active")
      .map((p) => p.userId)
  );
  return mockRegisteredUsers
    .filter((u) => !activeUserIds.has(u.userId))
    .map((u) => ({
      userId: u.userId,
      name: u.userName,
      systemRole: systemRoleToShiftRole(u.systemRole),
    }));
}

export function ShiftsPage() {
  const [shift, setShift] = useState<Shift>(mockShifts.active);
  const [closedShifts, setClosedShifts] = useState<Shift[]>(mockShifts.closed);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<ShiftParticipant | null>(null);

  const { authenticatedUser, participants: contextParticipants, addParticipant, removeParticipant, canAddParticipant, canRemoveParticipant, canTransferResponsibility, isCurrentUserResponsible, getContextResponsibleUserId } = useMockSession();
  const {
    showTransferModal,
    selectedTransferUser,
    transferPin,
    transferError,
    isEnding,
    openTransfer,
    closeTransfer,
    handlePinChange,
    handleTransferConfirm,
  } = useResponsibilityTransfer();

  // ── Context-derived values (single source of truth) ──

  const activeContextParticipants = useMemo(
    () => contextParticipants.filter((p) => p.status === "active"),
    [contextParticipants]
  );

  const displayParticipants = useMemo(
    () => activeContextParticipants.map(participantToShiftParticipant),
    [activeContextParticipants]
  );

  const contextResponsibleUserId = getContextResponsibleUserId() ?? shift.responsibleUserId;

  // ── Derived available users (computed from context, no local state) ──

  const availableUsers = useMemo(
    () => getAvailableUsers(contextParticipants),
    [contextParticipants]
  );

  // ── Derived shift for child components ──

  const derivedShift = useMemo<Shift>(
    () => ({
      ...shift,
      participants: displayParticipants,
      responsibleUserId: contextResponsibleUserId,
    }),
    [shift, displayParticipants, contextResponsibleUserId]
  );

  // ── Permissions (delegated to domain capabilities) ──

  // ── Handlers ──

  const handleAddParticipant = (user: { userId: string; name: string; systemRole: "owner" | "employee" }) => {
    if (!canAddParticipant()) return;

    addParticipant(user.userId);

    // Only update shift activity — the participant is managed by context
    const newActivity = {
      id: `activity-${Date.now()}`,
      type: "participant_joined" as const,
      description: `${user.name} se incorporó como participante`,
      occurredAt: new Date().toISOString(),
      performedBy: user.name,
    };

    setShift((prev) => ({
      ...prev,
      activity: [...prev.activity, newActivity],
    }));
  };

  const handleRemoveParticipant = (participantId: string) => {
    const participant = derivedShift.participants.find((p) => p.id === participantId);
    if (!participant) return;

    if (!canRemoveParticipant(participant.userId)) return;

    const result = removeParticipant(participant.userId);
    if (!result.success) return;

    // Only update shift activity — the participant is managed by context
    const newActivity = {
      id: `activity-${Date.now()}`,
      type: "participant_left" as const,
      description: `${participant.name} salió del turno`,
      occurredAt: new Date().toISOString(),
      performedBy: participant.name,
    };

    setShift((prev) => ({
      ...prev,
      activity: [...prev.activity, newActivity],
    }));
  };

  const handleTransferFromCard = (participant: ShiftParticipant) => {
    if (participant.userId !== contextResponsibleUserId) {
      setSelectedParticipant(participant);
      openTransfer(participant.userId);
    }
  };

  const handleRemoveFromCard = (participantId: string) => {
    const participant = derivedShift.participants.find((p) => p.id === participantId);
    if (participant) {
      setSelectedParticipant(participant);
      setIsRemoveDialogOpen(true);
    }
  };

  const handleStartClosing = () => {
    window.location.href = "/cash-closing";
  };

  return (
    <div>
      <PageHeader
        title="Turnos"
        description="Consulta el turno activo, sus participantes y el historial de jornadas."
      />

      <div className="mt-6 space-y-6">
        <ActiveShiftCard
          shift={derivedShift}
          onViewDetails={() => setIsDetailsModalOpen(true)}
          onManageParticipants={() => {
            const participantsSection = document.getElementById("participants-section");
            participantsSection?.scrollIntoView({ behavior: "smooth" });
          }}
          onTransferResponsibility={() => {
            if (isCurrentUserResponsible()) {
              const responsibleUserId = getContextResponsibleUserId();
              if (responsibleUserId) {
                openTransfer(responsibleUserId);
              }
            }
          }}
          onStartClosing={handleStartClosing}
        />

        <div id="participants-section" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ShiftParticipants
            shift={derivedShift}
            canAddParticipants={canAddParticipant()}
            canRemoveParticipants={canAddParticipant()}
            canTransferResponsibility={isCurrentUserResponsible()}
            onAddParticipant={() => setIsAddModalOpen(true)}
            onRemoveParticipant={handleRemoveParticipant}
            onTransferResponsibility={handleTransferFromCard}
          />

          <ShiftActivityTimeline activities={shift.activity} />
        </div>

        <ShiftHistory shifts={closedShifts} />
      </div>

      <AddParticipantModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        availableUsers={availableUsers}
        onAdd={handleAddParticipant}
      />

      {showTransferModal && selectedTransferUser && (
        <TransferResponsibilityModal
          isEnding={isEnding}
          selectedParticipant={selectedTransferUser}
          transferSummary={null}
          transferPin={transferPin}
          transferError={transferError}
          onClose={closeTransfer}
          onPinChange={handlePinChange}
          onConfirm={handleTransferConfirm}
        />
      )}

      <RemoveParticipantDialog
        isOpen={isRemoveDialogOpen}
        onClose={() => {
          setIsRemoveDialogOpen(false);
          setSelectedParticipant(null);
        }}
        participant={selectedParticipant}
        onConfirm={() => {
          if (selectedParticipant) {
            handleRemoveParticipant(selectedParticipant.id);
          }
        }}
      />

      <ShiftDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        shift={derivedShift}
      />
    </div>
  );
}