"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMockSession } from "@/components/session/MockSessionContext";
import type { RegisteredUser } from "./types";
import { UserPinStep } from "./UserPinStep";
import { UserSelectionStep } from "./UserSelectionStep";

type ModalStep = "selection" | "pin";

interface WorkstationAccessModalProps {
  open: boolean;
  mode: "access" | "join";
  registeredUsers: RegisteredUser[];
  activeUserIds: string[];
  preselectedUserId?: string | null;
  onAccess: (userId: string) => void;
  onJoin: (userId: string) => void;
  onCancel: () => void;
}

export function WorkstationAccessModal({
  open,
  mode,
  registeredUsers,
  activeUserIds,
  preselectedUserId,
  onAccess,
  onJoin,
  onCancel,
}: WorkstationAccessModalProps) {
  const { getUserAvatar } = useMockSession();
  const [step, setStep] = useState<ModalStep>("selection");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Reset state unless we're in access mode with a preselected user
  useEffect(() => {
    if (open) {
      if (mode === "access" && preselectedUserId) {
        // Skip selection step, go directly to PIN
        setSelectedUserId(preselectedUserId);
        setStep("pin");
      } else {
        setStep("selection");
        setSelectedUserId(null);
      }
    }
  }, [open, mode, preselectedUserId]);

  useEffect(() => {
    if (open && titleRef.current) {
      titleRef.current.focus();
    }
  }, [open]);

  const handleSelect = useCallback((userId: string) => {
    setSelectedUserId(userId);
  }, []);

  const handleContinue = useCallback(() => {
    if (selectedUserId) {
      setStep("pin");
    }
  }, [selectedUserId]);

  const handleBack = useCallback(() => {
    if (step === "pin") {
      if (mode === "access" && preselectedUserId) {
        // In access mode with preselection, going back means cancel
        onCancel();
      } else {
        setStep("selection");
      }
    } else {
      onCancel();
    }
  }, [step, onCancel, mode, preselectedUserId]);

  const handleConfirm = useCallback(() => {
    if (!selectedUserId) return;

    if (mode === "access") {
      onAccess(selectedUserId);
    } else {
      onJoin(selectedUserId);
    }

    // Reset state after confirmation
    setSelectedUserId(null);
    setStep("selection");
  }, [selectedUserId, mode, onAccess, onJoin]);

  const handleCancel = useCallback(() => {
    setSelectedUserId(null);
    setStep("selection");
    onCancel();
  }, [onCancel]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleCancel]);

  if (!open) return null;

  const selectedUser = registeredUsers.find((u) => u.userId === selectedUserId);
  const title =
    mode === "access" ? "Acceder al sistema" : "Entrar con otro usuario";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workstation-access-title"
    >
      <div className="relative mx-auto w-full max-w-lg rounded-2xl bg-white shadow-2xl animate-scale-in">
        <div className="flex items-center justify-between border-b border-brand-border px-6 py-4">
          <h2
            id="workstation-access-title"
            ref={titleRef}
            tabIndex={-1}
            className="text-lg font-semibold text-brand-text outline-none"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={handleCancel}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-brand-text-muted hover:bg-brand-primary-soft hover:text-brand-primary transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5">
          {step === "selection" ? (
            <UserSelectionStep
              registeredUsers={registeredUsers}
              activeUserIds={activeUserIds}
              selectedUserId={selectedUserId}
              onSelect={handleSelect}
              onBack={handleCancel}
              onContinue={handleContinue}
            />
          ) : (
            selectedUser && (
              <UserPinStep
                selectedUserName={selectedUser.userName}
                selectedUserAvatar={getUserAvatar(selectedUser.userId)}
                onBack={handleBack}
                onConfirm={handleConfirm}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}
