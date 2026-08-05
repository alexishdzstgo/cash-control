"use client";

import { Printer, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type {
  ReceiptBusinessIdentity,
  ReceiptData,
  ReceiptPaperSize,
  ReceiptPreferences,
} from "@/types/receipt";
import { ReceiptDocument } from "./ReceiptDocument";

type ReceiptPreviewDialogProps = {
  isOpen: boolean;
  receiptData: ReceiptData | null;
  businessIdentity: ReceiptBusinessIdentity;
  preferences: ReceiptPreferences;
  onClose: () => void;
};

export function ReceiptPreviewDialog({
  isOpen,
  receiptData,
  businessIdentity,
  preferences,
  onClose,
}: ReceiptPreviewDialogProps) {
  const [paperSize, setPaperSize] = useState<ReceiptPaperSize>(
    preferences.paperSize,
  );
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPaperSize(preferences.paperSize);
    titleRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, preferences.paperSize]);

  if (!isOpen || !receiptData) {
    return null;
  }

  const previewPreferences = { ...preferences, paperSize };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4 no-print"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-preview-title"
        className="flex max-h-[90dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-sm font-medium text-[#2563EB]">Comprobante</p>
            <h2
              id="receipt-preview-title"
              ref={titleRef}
              tabIndex={-1}
              className="text-lg font-bold text-slate-900 outline-none"
            >
              Vista previa
            </h2>
          </div>
          <button
            type="button"
            aria-label="Cerrar vista previa"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto bg-slate-100 p-5">
          <div className="mb-4 flex flex-wrap gap-2">
            {(["58mm", "80mm", "digital"] as const).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setPaperSize(size)}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                  paperSize === size
                    ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {size}
              </button>
            ))}
          </div>

          <div className="receipt-print-root mx-auto w-fit">
            <ReceiptDocument
              data={receiptData}
              businessIdentity={businessIdentity}
              preferences={previewPreferences}
              paperSize={paperSize}
            />
          </div>
        </div>

        <footer className="flex shrink-0 flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#CBD5E1] bg-white px-4 py-2 text-sm font-semibold text-[#334155] transition hover:bg-[#F1F5F9]"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1D4ED8]"
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            Imprimir comprobante
          </button>
        </footer>
      </div>
    </div>
  );
}
