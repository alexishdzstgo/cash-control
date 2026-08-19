"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";

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
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    titleRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4">
      <div className="cc-modal-surface flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-xl shadow-xl">
        <header className="cc-modal-header flex items-start justify-between gap-4 p-5">
          <div>
            <p className="cc-modal-description text-sm font-medium">
              Centro de configuración
            </p>
            <h2
              ref={titleRef}
              tabIndex={-1}
              className="cc-modal-title text-lg font-bold outline-none"
            >
              {title}
            </h2>
            {description && (
              <p className="cc-modal-description mt-1 text-sm leading-6">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto p-5">
          {children}
        </div>
        <footer className="flex justify-end gap-3 border-t border-slate-200 p-5">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={onSave}>
            Guardar cambios
          </button>
        </footer>
      </div>
    </div>
  );
}
