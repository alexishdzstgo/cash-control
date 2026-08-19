"use client";

import { ModalShell } from "@/components/shared/ModalShell";
import { Button } from "@/components/ui/button";

interface EndParticipationModalProps {
  isEnding: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function EndParticipationModal({
  isEnding,
  onClose,
  onConfirm,
}: EndParticipationModalProps) {
  return (
    <ModalShell
      title="Finalizar participacion"
      onClose={onClose}
      closeOnOverlayClick
      maxWidth="sm"
      labelledById="end-participation-title"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isEnding}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={isEnding} className="gap-2">
            {isEnding ? "Finalizando..." : "Finalizar participacion"}
          </Button>
        </div>
      }
    >
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-600">
          Deseas finalizar tu participacion?
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Dejaras de aparecer como participante activo y tendras que iniciar una
          nueva participacion para volver a registrar operaciones.
        </p>
      </div>
    </ModalShell>
  );
}
