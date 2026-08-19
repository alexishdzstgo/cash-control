"use client";

import { Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { ModalShell } from "@/components/shared/ModalShell";
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
  useEffect(() => {
    if (!isOpen) return;
    setPaperSize(preferences.paperSize);

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
    <ModalShell
      title="Vista previa"
      description="Comprobante"
      onClose={onClose}
      closeLabel="Cerrar vista previa"
      closeOnOverlayClick
      maxWidth="xl"
      zIndex="high"
      labelledById="receipt-preview-title"
      bodyClassName="bg-slate-100"
      footerClassName="no-print"
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-primary"
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            Imprimir comprobante
          </button>
        </div>
      }
    >
      <div className="no-print mb-4 flex flex-wrap gap-2">
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
    </ModalShell>
  );
}
