"use client";

import { type ReactNode, useEffect } from "react";
import { ModalShell } from "@/components/shared/ModalShell";

type ConfigEditDialogProps = {
  isOpen: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  onSave: () => void;
};

export function ConfigEditDialog({
  isOpen,
  title,
  description,
  children,
  onClose,
  onSave,
}: ConfigEditDialogProps) {
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <ModalShell
      title={title}
      description={description ?? "Centro de configuracion"}
      onClose={onClose}
      maxWidth="lg"
      zIndex="high"
      footer={
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={onSave}>
            Guardar cambios
          </button>
        </div>
      }
    >
      {children}
    </ModalShell>
  );
}
