"use client";

import { useEffect, useState } from "react";
import { ModalShell } from "@/components/shared/ModalShell";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Button } from "@/components/ui/button";
import type { ShiftParticipant, SystemRole } from "@/types/shift";

interface AddParticipantModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableUsers: Omit<
    ShiftParticipant,
    "id" | "joinedAt" | "leftAt" | "status" | "shiftRole"
  >[];
  onAdd: (
    user: Omit<
      ShiftParticipant,
      "id" | "joinedAt" | "leftAt" | "status" | "shiftRole"
    >,
  ) => void;
}

const systemRoleLabels: Record<SystemRole, string> = {
  owner: "Dueño",
  employee: "Empleado",
};

export function AddParticipantModal({
  isOpen,
  onClose,
  availableUsers,
  onAdd,
}: AddParticipantModalProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  useEffect(() => {
    if (!isOpen) {
      setSelectedUserId("");
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const selectedUser = availableUsers.find((u) => u.userId === selectedUserId);

  const handleConfirm = () => {
    if (!selectedUser) return;
    onAdd(selectedUser);
    onClose();
  };

  return (
    <ModalShell
      title="Agregar participante"
      description="Selecciona un usuario para agregarlo al turno como operador."
      onClose={onClose}
      maxWidth="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="default"
            onClick={handleConfirm}
            disabled={!selectedUser}
          >
            Agregar
          </Button>
        </div>
      }
    >
      <div className="mt-4 space-y-2">
        {availableUsers.map((user) => (
          <button
            key={user.userId}
            type="button"
            onClick={() => setSelectedUserId(user.userId)}
            className={`w-full rounded-lg border p-4 text-left transition ${
              selectedUserId === user.userId
                ? "border-[#2563EB] bg-[#EFF6FF]"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center gap-3">
              <UserAvatar name={user.name} avatar={user.avatar} size="sm" />
              <div>
                <p className="font-medium text-slate-900">{user.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {systemRoleLabels[user.systemRole]}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </ModalShell>
  );
}
