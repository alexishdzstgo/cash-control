"use client";

import { useEffect } from "react";
import { ModalShell } from "@/components/shared/ModalShell";

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
    <ModalShell
      title={title}
      description={description}
      onClose={onClose}
      closeOnOverlayClick
      maxWidth="sm"
      zIndex="high"
      labelledById="success-dialog-title"
      footer={
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="btn-primary">
            {buttonLabel}
          </button>
        </div>
      }
    />
  );
}
