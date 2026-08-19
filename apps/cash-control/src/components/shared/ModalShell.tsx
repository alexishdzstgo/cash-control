"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

type ModalMaxWidth = "sm" | "md" | "lg" | "xl";
type ModalZIndex = "default" | "high" | "top";

type ModalShellProps = {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  maxWidth?: ModalMaxWidth;
  zIndex?: ModalZIndex;
  labelledById?: string;
  closeOnOverlayClick?: boolean;
  showCloseButton?: boolean;
  className?: string;
  bodyClassName?: string;
  footerClassName?: string;
};

const maxWidthClasses: Record<ModalMaxWidth, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

const zIndexClasses: Record<ModalZIndex, string> = {
  default: "z-50",
  high: "z-[70]",
  top: "z-[90]",
};

export function ModalShell({
  title,
  description,
  children,
  footer,
  onClose,
  closeLabel = "Cerrar",
  maxWidth = "lg",
  zIndex = "default",
  labelledById = "modal-shell-title",
  closeOnOverlayClick = false,
  showCloseButton = true,
  className = "",
  bodyClassName = "",
  footerClassName = "",
}: ModalShellProps) {
  return (
    <div
      className={`fixed inset-0 ${zIndexClasses[zIndex]} flex items-center justify-center overflow-y-auto bg-slate-950/40 p-3 sm:p-6`}
    >
      {closeOnOverlayClick && onClose && (
        <button
          type="button"
          aria-label={closeLabel}
          className="absolute inset-0 cursor-default"
          onClick={onClose}
        />
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledById}
        className={`cc-modal-surface relative z-10 my-4 flex max-h-[90dvh] w-full ${maxWidthClasses[maxWidth]} flex-col overflow-hidden rounded-2xl shadow-xl animate-in fade-in zoom-in-95 duration-200 ${className}`}
      >
        <header className="cc-modal-header flex shrink-0 items-start justify-between gap-4 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={labelledById} className="cc-modal-title text-lg font-bold">
              {title}
            </h2>
            {description && (
              <p className="cc-modal-description mt-1 text-sm leading-6">
                {description}
              </p>
            )}
          </div>

          {showCloseButton && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-xl p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
              aria-label={closeLabel}
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </header>

        {children && (
          <div
            className={`scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 ${bodyClassName}`}
          >
            {children}
          </div>
        )}

        {footer && (
          <footer
            className={`shrink-0 border-t border-slate-200 px-5 py-4 sm:px-6 ${footerClassName}`}
          >
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
