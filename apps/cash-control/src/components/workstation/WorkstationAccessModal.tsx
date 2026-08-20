"use client";

import { useCallback, useEffect, useState } from "react";
import { useMockSession } from "@/components/session/MockSessionContext";
import { ModalShell } from "@/components/shared/ModalShell";
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

  useEffect(() => {
    if (open) {
      if (mode === "access" && preselectedUserId) {
        setSelectedUserId(preselectedUserId);
        setStep("pin");
      } else {
        setStep("selection");
        setSelectedUserId(null);
      }
    }
  }, [open, mode, preselectedUserId]);

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
  const description =
    step === "selection"
      ? "Selecciona el usuario que va a operar en esta estacion."
      : "Ingresa el PIN para confirmar el acceso.";

  return (
    <ModalShell
      title={title}
      description={description}
      onClose={handleCancel}
      maxWidth="md"
      labelledById="workstation-access-title"
    >
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
    </ModalShell>
  );
}
