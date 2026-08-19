"use client";

import { useEffect, useState } from "react";
import { ModalShell } from "@/components/shared/ModalShell";
import { Button } from "@/components/ui/button";
import type { ShiftParticipant } from "@/types/shift";

interface RemoveParticipantDialogProps {
  isOpen: boolean;
  onClose: () => void;
  participant: ShiftParticipant | null;
  onConfirm: () => void;
}

export function RemoveParticipantDialog({
  isOpen,
  onClose,
  participant,
  onConfirm,
}: RemoveParticipantDialogProps) {
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setError("");
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

  if (!isOpen || !participant) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <ModalShell
      title="Retirar participante"
      description={participant.name}
      onClose={onClose}
      maxWidth="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirm}>
            Retirar
          </Button>
        </div>
      }
    >
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-600">
          Retirar a{" "}
          <span className="font-medium text-slate-900">{participant.name}</span>{" "}
          del turno?
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Ya no podra registrar nuevas operaciones en este turno, pero su
          actividad anterior permanecera visible.
        </p>
        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
      </div>
    </ModalShell>
  );
}
