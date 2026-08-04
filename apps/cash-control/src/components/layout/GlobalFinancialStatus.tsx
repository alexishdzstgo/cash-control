"use client";

import { AlertTriangle, ChevronDown, Landmark, Wallet } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatCurrency } from "@/lib/formatters";
import {
  computeBankMovementAlerts,
  computeFinancialTotals,
} from "@/lib/finance";

export function GlobalFinancialStatus() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const totals = computeFinancialTotals();
  const bankAlerts = computeBankMovementAlerts().filter(
    (alert) => alert.isAtLimit || alert.isNearLimit,
  );
  const totalAlerts = bankAlerts.length;
  const hasAlerts = totalAlerts > 0;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-1.5 transition hover:border-slate-300 hover:bg-slate-50"
      >
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
          <div className="text-left">
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Disponible para operar
            </p>
            <p className="text-sm font-semibold text-slate-900 tabular-nums">
              {formatCurrency(totals.totalAvailable)}
            </p>
          </div>
        </div>

        <span className="mx-1 h-6 w-px bg-slate-200" aria-hidden="true" />

        <div className="flex items-center gap-1.5">
          {hasAlerts ? (
            <>
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
              <span className="text-xs font-medium text-amber-700">
                {totalAlerts === 1 ? "1 alerta" : `${totalAlerts} alertas`}
              </span>
            </>
          ) : (
            <>
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
              <span className="text-xs font-medium text-emerald-700">
                Todo bajo control
              </span>
            </>
          )}
        </div>

        {hasAlerts && (
          <ChevronDown
            className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        )}
      </button>

      {isOpen && hasAlerts && (
        <div
          role="dialog"
          aria-label="Alertas del sistema"
          className="absolute left-0 top-[calc(100%+8px)] z-50 w-80 rounded-lg border border-slate-200 bg-white p-2 shadow-xl"
        >
          <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Alertas importantes
          </p>
          <div className="space-y-1">
            {bankAlerts.map((alert) => (
              <div
                key={alert.bankId}
                className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5"
              >
                {alert.isAtLimit ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
                ) : (
                  <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                )}
                <div>
                  <p className="text-xs font-semibold text-slate-900">{alert.bankName}</p>
                  <p className="text-[11px] text-slate-600">
                    {alert.isAtLimit
                      ? "Límite de movimientos alcanzado"
                      : `${alert.remainingVisibleMovements} movimientos visibles restantes`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}