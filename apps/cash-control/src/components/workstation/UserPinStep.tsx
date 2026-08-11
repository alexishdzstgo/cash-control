"use client";

import { useEffect, useRef, useState } from "react";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Button } from "@/components/ui/button";
import type { UserAvatar as UserAvatarModel } from "@/types/user";

const VALID_PIN = "1234";

interface UserPinStepProps {
  selectedUserName: string;
  selectedUserAvatar?: UserAvatarModel;
  onBack: () => void;
  onConfirm: () => void;
}

export function UserPinStep({
  selectedUserName,
  selectedUserAvatar,
  onBack,
  onConfirm,
}: UserPinStepProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    pinInputRef.current?.focus();
  }, []);

  const handlePinChange = (value: string) => {
    if (/^\d*$/.test(value) && value.length <= 4) {
      setPin(value);
      if (error) setError(null);
    }
  };

  const handleConfirm = () => {
    if (pin !== VALID_PIN) {
      setError("PIN incorrecto. Intenta de nuevo.");
      return;
    }
    onConfirm();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && pin.length === 4) {
      handleConfirm();
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-brand-border bg-brand-primary-soft/50 p-4">
        <div className="flex items-center gap-3">
          <UserAvatar name={selectedUserName} avatar={selectedUserAvatar} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-primary">
              Usuario seleccionado
            </p>
            <p className="text-lg font-bold text-brand-text">
              {selectedUserName}
            </p>
          </div>
        </div>
      </div>

      <div>
        <label
          htmlFor="user-pin"
          className="mb-2 block text-sm font-medium text-brand-text"
        >
          Ingresa tu PIN de 4 dígitos:
        </label>
        <input
          id="user-pin"
          type="password"
          inputMode="numeric"
          maxLength={4}
          ref={pinInputRef}
          value={pin}
          onChange={(e) => handlePinChange(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-describedby={error ? "pin-error" : undefined}
          aria-invalid={error ? "true" : undefined}
          className={`block w-full max-w-[180px] rounded-lg border px-4 py-3 text-center text-2xl tracking-[0.5em] shadow-sm transition-colors placeholder:text-brand-text-muted focus:outline-none focus:ring-2 ${
            error
              ? "border-red-300 focus:border-red-400 focus:ring-red-200"
              : "border-brand-border focus:border-brand-primary-ring focus:ring-brand-primary-ring"
          }`}
          placeholder="••••"
        />

        {error && (
          <p id="pin-error" className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-brand-border pt-5">
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-medium text-brand-text-muted hover:text-brand-text"
        >
          No soy {selectedUserName}
        </button>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack}>
            Volver
          </Button>
          <Button onClick={handleConfirm} disabled={pin.length !== 4}>
            Confirmar
          </Button>
        </div>
      </div>
    </div>
  );
}
