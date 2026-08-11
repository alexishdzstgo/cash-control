"use client";

import { useEffect, useRef, useState } from "react";
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
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Agregar participante
          </h2>
          <button
            type="button"
            ref={closeButtonRef}
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition hover:text-slate-600"
            aria-label="Cerrar"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <p className="text-sm text-slate-500">
            Selecciona un usuario para agregarlo al turno como operador.
          </p>

          <div className="mt-4 space-y-2">
            {availableUsers.map((user) => (
              <button
                key={user.userId}
                type="button"
                onClick={() => setSelectedUserId(user.userId)}
                className={`w-full rounded-lg border p-4 text-left transition ${
                  selectedUserId === user.userId
                    ? "border-slate-400 bg-slate-50"
                    : "border-slate-200 hover:border-slate-300"
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
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 p-6">
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
      </div>
    </div>
  );
}
