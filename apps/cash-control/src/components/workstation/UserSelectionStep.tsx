"use client";

import { Check } from "lucide-react";
import { useMockSession } from "@/components/session/MockSessionContext";
import { ModalSection } from "@/components/shared/ModalShell";
import { UserAvatar } from "@/components/shared/UserAvatar";
import type { RegisteredUser } from "./types";

interface UserSelectionStepProps {
  registeredUsers: RegisteredUser[];
  activeUserIds: string[];
  selectedUserId: string | null;
  onSelect: (userId: string) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function UserSelectionStep({
  registeredUsers,
  activeUserIds,
  selectedUserId,
  onSelect,
  onBack,
  onContinue,
}: UserSelectionStepProps) {
  const { getUserAvatar } = useMockSession();
  const inactiveUsers = registeredUsers.filter(
    (u) => !activeUserIds.includes(u.userId),
  );

  return (
    <div className="space-y-6">
      <ModalSection>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Nuevo participante
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Selecciona tu perfil para incorporarte a la jornada actual.
        </p>
      </ModalSection>

      {inactiveUsers.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-600">
          Todos los usuarios registrados ya estan participando activamente.
        </p>
      ) : (
        <ul className="space-y-2" aria-label="Usuarios disponibles">
          {inactiveUsers.map((user) => {
            const isSelected = selectedUserId === user.userId;
            return (
              <li key={user.userId}>
                <button
                  type="button"
                  onClick={() => onSelect(user.userId)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                    isSelected
                      ? "border-[#2563EB] bg-[#EFF6FF] ring-2 ring-blue-100"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <UserAvatar
                    name={user.userName}
                    avatar={getUserAvatar(user.userId)}
                  />
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">
                      {user.userName}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2563EB] text-white">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-5">
        <button type="button" className="btn-secondary" onClick={onBack}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onContinue}
          disabled={!selectedUserId}
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
