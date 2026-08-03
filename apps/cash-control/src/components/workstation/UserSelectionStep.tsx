"use client";

import { Check, UserRound, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const inactiveUsers = registeredUsers.filter(
    (u) => !activeUserIds.includes(u.userId),
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-brand-border bg-brand-primary-soft/50 p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary-soft text-brand-primary">
            <UserPlus className="h-4 w-4" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wide text-brand-primary">
            Nuevo participante
          </span>
        </div>
        <p className="mt-2 text-sm text-brand-text-muted">
          Selecciona tu perfil para incorporarte a la jornada actual.
        </p>
      </div>

      {inactiveUsers.length === 0 ? (
        <p className="py-8 text-center text-sm text-brand-text-muted">
          Todos los usuarios registrados ya están participando activamente.
        </p>
      ) : (
        <ul className="space-y-2" role="listbox" aria-label="Usuarios disponibles">
          {inactiveUsers.map((user) => {
            const isSelected = selectedUserId === user.userId;
            return (
              <li key={user.userId} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => onSelect(user.userId)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                    isSelected
                      ? "border-brand-primary-ring bg-brand-primary-soft ring-2 ring-brand-primary-ring"
                      : "border-brand-border bg-white hover:border-brand-primary-ring hover:bg-brand-primary-soft/30"
                  }`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary-soft text-brand-primary">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-brand-text">{user.userName}</p>
                  </div>
                  {isSelected && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-primary text-white">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
        <Button variant="outline" onClick={onBack}>
          Cancelar
        </Button>
        <Button onClick={onContinue} disabled={!selectedUserId}>
          Continuar
        </Button>
      </div>
    </div>
  );
}