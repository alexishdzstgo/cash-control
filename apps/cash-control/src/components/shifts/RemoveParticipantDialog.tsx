"use client";

import { useEffect, useRef, useState } from "react";
import type { ShiftParticipant } from "@/types/shift";
import { Button } from "@/components/ui/button";

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
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900">Retirar participante</h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition hover:text-slate-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <p className="text-sm text-slate-600">
            ¿Retirar a <span className="font-medium text-slate-900">{participant.name}</span> del turno?
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Ya no podrá registrar nuevas operaciones en este turno, pero su actividad anterior permanecerá visible.
          </p>
          {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 p-6">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirm}>
            Retirar
          </Button>
        </div>
      </div>
    </div>
  );
}
