"use client";

import { useEffect, useRef, useState } from "react";
import { ModalSection } from "@/components/shared/ModalShell";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { useUsers } from "@/components/users/UsersContext";
import type { UserAvatar as UserAvatarModel } from "@/types/user";

interface UserPinStepProps {
  selectedUserId: string;
  selectedUserName: string;
  selectedUserAvatar?: UserAvatarModel;
  onBack: () => void;
  onConfirm: () => void;
}

export function UserPinStep({
  selectedUserId,
  selectedUserName,
  selectedUserAvatar,
  onBack,
  onConfirm,
}: UserPinStepProps) {
  const { validatePin } = useUsers();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    pinInputRef.current?.focus();
  }, []);

  const handlePinChange = (value: string) => {
    if (/^\d*$/.test(value) && value.length <= 6) {
      setPin(value);
      if (error) setError(null);
    }
  };

  const handleConfirm = () => {
    if (!validatePin(selectedUserId, pin)) {
      setError("PIN incorrecto. Intenta de nuevo.");
      return;
    }
    onConfirm();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && /^\d{4,6}$/.test(pin)) {
      handleConfirm();
    }
  };

  return (
    <div className="space-y-6">
      <ModalSection>
        <div className="flex items-center gap-3">
          <UserAvatar name={selectedUserName} avatar={selectedUserAvatar} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Usuario seleccionado
            </p>
            <p className="text-lg font-bold text-slate-900">
              {selectedUserName}
            </p>
          </div>
        </div>
      </ModalSection>

      <div>
        <label
          htmlFor="user-pin"
          className="cc-form-label mb-2 block text-sm font-semibold"
        >
          Ingresa tu PIN de 4 a 6 dígitos
        </label>
        <input
          id="user-pin"
          type="password"
          inputMode="numeric"
          maxLength={6}
          ref={pinInputRef}
          value={pin}
          onChange={(e) => handlePinChange(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-describedby={error ? "pin-error" : undefined}
          aria-invalid={error ? "true" : undefined}
          className={`field-input block max-w-[180px] text-center text-2xl tracking-[0.5em] ${
            error
              ? "border-red-300 focus:border-red-400 focus:ring-red-200"
              : ""
          }`}
          placeholder="••••"
        />

        {error && (
          <p id="pin-error" className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-5">
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          No soy {selectedUserName}
        </button>
        <div className="flex gap-3">
          <button type="button" className="btn-secondary" onClick={onBack}>
            Volver
          </button>
          <button
            type="button"
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleConfirm}
            disabled={!/^\d{4,6}$/.test(pin)}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
