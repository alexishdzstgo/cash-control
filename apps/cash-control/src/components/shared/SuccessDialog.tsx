"use client";

import { CheckCircle2, X } from "lucide-react";
import { useEffect } from "react";

type SuccessDialogProps = {
  isOpen: boolean;
  title: string;
  description: string;
  buttonLabel?: string;
  onClose: () => void;
};

export function SuccessDialog({
  isOpen,
  title,
  description,
  buttonLabel = "Continuar",
  onClose,
}: SuccessDialogProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="success-dialog-title"
        className="cc-modal-surface relative z-10 w-full max-w-md overflow-hidden rounded-xl shadow-xl"
      >
        <div className="cc-modal-header flex items-start justify-between p-5">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h2
                id="success-dialog-title"
                className="cc-modal-title font-semibold"
              >
                {title}
              </h2>
              <p className="cc-modal-description mt-1 text-sm leading-6">
                {description}
              </p>
            </div>
          </div>
          <button
            type="button"
            title="Cerrar"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex justify-end p-5">
          <button type="button" onClick={onClose} className="btn-primary">
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
