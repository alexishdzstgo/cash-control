"use client";

import { Button } from "@/components/ui/button";

interface EndParticipationModalProps {
  isEnding: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function EndParticipationModal({ isEnding, onClose, onConfirm }: EndParticipationModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="end-participation-title"
    >
      <div
        className="relative mx-auto w-full max-w-md rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 px-6 py-4">
          <h2
            id="end-participation-title"
            className="text-lg font-semibold text-slate-900"
          >
            Finalizar participación
          </h2>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm text-slate-600">
            ¿Deseas finalizar tu participación?
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Dejarás de aparecer como participante activo y tendrás que iniciar una nueva participación para volver a registrar operaciones.
          </p>

          <div className="mt-6 flex items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isEnding}
            >
              Cancelar
            </Button>
            <Button
              onClick={onConfirm}
              disabled={isEnding}
              className="gap-2"
            >
              {isEnding ? "Finalizando..." : "Finalizar participación"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}