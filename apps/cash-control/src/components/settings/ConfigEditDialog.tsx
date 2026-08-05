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
      <div className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div>
            <p className="text-sm font-medium text-[#2563EB]">
              Centro de configuración
            </p>
            <h2
              ref={titleRef}
              tabIndex={-1}
              className="text-lg font-bold text-slate-950 outline-none"
            >
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto p-5">
          {children}
        </div>
        <footer className="flex justify-end gap-3 border-t border-slate-100 p-5">
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
