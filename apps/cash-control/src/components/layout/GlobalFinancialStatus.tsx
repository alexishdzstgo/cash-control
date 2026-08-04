"use client";

import { ChevronDown, Landmark, Wallet } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { formatCurrency } from "@/lib/formatters";
import {
  computeBankMovementAlerts,
  computeFinancialTotals,
  type BalanceHealthStatus,
  type BankBreakdownItem,
} from "@/lib/finance";

type HealthStyle = {
  labelClass: string;
  valueClass: string;
  dotClass: string;
  bgClass?: string;
};

const HEALTH_STYLES: Record<BalanceHealthStatus, HealthStyle> = {
  normal: {
    labelClass: "text-slate-500",
    valueClass: "text-slate-800",
    dotClass: "bg-slate-300",
  },
  warning: {
    labelClass: "text-amber-700",
    valueClass: "text-amber-800",
    dotClass: "bg-amber-500",
    bgClass: "bg-amber-50/60",
  },
  critical: {
    labelClass: "text-red-700",
    valueClass: "text-red-800",
    dotClass: "bg-red-500",
    bgClass: "bg-red-50/60",
  },
};

const HEALTH_LABELS: Record<BalanceHealthStatus, string> = {
  normal: "",
  warning: "Saldo bajo",
  critical: "Saldo crítico",
};

type ConsolidatedAlert = {
  id: string;
  title: string;
  detail: string;
  severity: "critical" | "warning";
  icon: "balance" | "movement";
};

export function GlobalFinancialStatus() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const totals = computeFinancialTotals();
  const bankAlerts = computeBankMovementAlerts().filter(
    (alert) => alert.isAtLimit || alert.isNearLimit,
  );

  // Build consolidated alerts from balance health + movement limits
  const alerts: ConsolidatedAlert[] = [];

  // Caja balance alert
  if (totals.cashIsLow || totals.cashIsCritical) {
    const status = totals.cashBalanceStatus;
    alerts.push({
      id: "cash-balance",
      title: "Caja física",
      detail:
        status === "critical"
          ? `Saldo crítico: ${formatCurrency(totals.cashAvailable)}`
          : `Saldo disponible bajo: ${formatCurrency(totals.cashAvailable)}`,
      severity: status === "critical" ? "critical" : "warning",
      icon: "balance",
    });
  }

  // Bank balance alerts
  for (const bank of totals.bankBreakdown) {
    if (bank.isLow || bank.isCritical) {
      const status = bank.balanceStatus;
      alerts.push({
        id: `${bank.bankId}-balance`,
        title: bank.bankName,
        detail:
          status === "critical"
            ? `Saldo crítico: ${formatCurrency(bank.available)}`
            : `Saldo disponible bajo: ${formatCurrency(bank.available)}`,
        severity: status === "critical" ? "critical" : "warning",
        icon: "balance",
      });
    }
  }

  // Bank movement alerts
  for (const alert of bankAlerts) {
    alerts.push({
      id: `${alert.bankId}-movement`,
      title: alert.bankName,
      detail: alert.isAtLimit
        ? "Límite de movimientos visibles alcanzado"
        : `${alert.remainingVisibleMovements} movimientos visibles restantes`,
      severity: alert.isAtLimit ? "critical" : "warning",
      icon: "movement",
    });
  }

  // Sort: critical first, then warning
  const sortedAlerts = [...alerts].sort((a, b) => {
    if (a.severity === b.severity) return 0;
    return a.severity === "critical" ? -1 : 1;
  });

  const totalAlerts = sortedAlerts.length;
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

  const bankItems = totals.bankBreakdown;

  return (
    <div
      ref={containerRef}
      className="flex min-w-0 items-center gap-2"
    >
      {/* ── Desktop wide: full financial bar ── */}
      <div className="hidden min-w-0 items-center gap-4 xl:flex">
        <StatusItem
          label="Disponible total"
          value={totals.totalAvailable}
          emphasized
        />
        <Divider />
        <StatusItem
          label="Caja"
          value={totals.cashAvailable}
          health="balance"
          healthStatus={totals.cashBalanceStatus}
        />
        <Divider />
        {bankItems.map((bank) => (
          <StatusItem
            key={bank.bankId}
            label={bank.bankName}
            value={bank.available}
            health="balance"
            healthStatus={bank.balanceStatus}
          />
        ))}
        <Divider />
        <AlertsButton
          hasAlerts={hasAlerts}
          totalAlerts={totalAlerts}
          isOpen={isOpen}
          setIsOpen={setIsOpen}
          buttonRef={buttonRef}
        />
      </div>

      {/* ── Medium: compact with banks popover ── */}
      <div className="hidden min-w-0 items-center gap-3 md:flex xl:hidden">
        <StatusItem
          label="Disponible total"
          value={totals.totalAvailable}
          emphasized
        />
        <Divider />
        <StatusItem
          label="Caja"
          value={totals.cashAvailable}
          health="balance"
          healthStatus={totals.cashBalanceStatus}
        />
        <Divider />
        <BanksPopover bankItems={bankItems} />
        <Divider />
        <AlertsButton
          hasAlerts={hasAlerts}
          totalAlerts={totalAlerts}
          isOpen={isOpen}
          setIsOpen={setIsOpen}
          buttonRef={buttonRef}
        />
      </div>

      {/* ── Small: summary + popover ── */}
      <div className="flex min-w-0 items-center gap-2 md:hidden">
        <StatusItem
          label="Disponible total"
          value={totals.totalAvailable}
          emphasized
        />
        <SummaryPopover
          totals={totals}
          bankItems={bankItems}
          bankAlerts={sortedAlerts}
          hasAlerts={hasAlerts}
        />
        <AlertsIndicator
          hasAlerts={hasAlerts}
          totalAlerts={totalAlerts}
          compact
        />
      </div>

      {/* Consolidated alerts popover (desktop + medium) */}
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
            {sortedAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-start gap-2 rounded-lg px-3 py-2.5 ${
                  alert.severity === "critical" ? "bg-red-50" : "bg-amber-50"
                }`}
              >
                {alert.icon === "balance" ? (
                  <Wallet
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      alert.severity === "critical"
                        ? "text-red-500"
                        : "text-amber-600"
                    }`}
                    aria-hidden="true"
                  />
                ) : (
                  <Landmark
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      alert.severity === "critical"
                        ? "text-red-500"
                        : "text-amber-600"
                    }`}
                    aria-hidden="true"
                  />
                )}
                <div>
                  <p className="text-xs font-semibold text-slate-900">
                    {alert.title}
                  </p>
                  <p className="text-[11px] text-slate-600">{alert.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusItem({
  label,
  value,
  emphasized = false,
  health = "none",
  healthStatus,
}: {
  label: string;
  value: number;
  emphasized?: boolean;
  health?: "balance" | "none";
  healthStatus?: BalanceHealthStatus;
}) {
  const style =
    health === "balance" && healthStatus
      ? HEALTH_STYLES[healthStatus]
      : HEALTH_STYLES.normal;

  const labelText =
    health === "balance" && healthStatus
      ? HEALTH_LABELS[healthStatus]
      : null;

  return (
    <div className={`min-w-0 shrink-0 rounded-md px-1.5 py-1 ${style.bgClass ?? ""}`}>
      <div className="flex items-center gap-1.5">
        {health === "balance" && healthStatus && healthStatus !== "normal" && (
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${style.dotClass}`}
            aria-hidden="true"
          />
        )}
        <p className={`truncate text-[10px] font-medium uppercase tracking-wide ${style.labelClass}`}>
          {label}
          {labelText ? ` · ${labelText}` : ""}
        </p>
      </div>
      <p
        className={`truncate tabular-nums ${
          emphasized
            ? "text-sm font-bold text-slate-950"
            : `text-sm font-semibold ${style.valueClass}`
        }`}
      >
        {formatCurrency(value)}
      </p>
    </div>
  );
}

function AlertsButton({
  hasAlerts,
  totalAlerts,
  isOpen,
  setIsOpen,
  buttonRef,
}: {
  hasAlerts: boolean;
  totalAlerts: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  buttonRef: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      onClick={() => setIsOpen(!isOpen)}
      className="flex shrink-0 items-center gap-1.5 rounded-lg px-1.5 py-1 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#93C5FD]"
    >
      <AlertsIndicator hasAlerts={hasAlerts} totalAlerts={totalAlerts} />
      {hasAlerts && (
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      )}
    </button>
  );
}

function AlertsIndicator({
  hasAlerts,
  totalAlerts,
  compact = false,
}: {
  hasAlerts: boolean;
  totalAlerts: number;
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {hasAlerts ? (
        <>
          <span
            className="inline-block h-2 w-2 rounded-full bg-amber-500"
            aria-hidden="true"
          />
          <span className="whitespace-nowrap text-xs font-medium text-amber-700">
            {compact
              ? `${totalAlerts}`
              : totalAlerts === 1
                ? "1 alerta"
                : `${totalAlerts} alertas`}
          </span>
        </>
      ) : (
        <>
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
          <span className="whitespace-nowrap text-xs font-medium text-emerald-700">
            {compact ? "" : "Todo bajo control"}
          </span>
        </>
      )}
    </div>
  );
}

function BanksPopover({ bankItems }: { bankItems: BankBreakdownItem[] }) {
  const [isBanksOpen, setIsBanksOpen] = useState(false);
  const banksButtonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setIsBanksOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsBanksOpen(false);
        banksButtonRef.current?.focus();
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
        ref={banksButtonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isBanksOpen}
        onClick={() => setIsBanksOpen((current) => !current)}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
      >
        <Landmark className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
        Bancos
        <ChevronDown
          className={`h-3 w-3 text-slate-400 transition-transform ${
            isBanksOpen ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {isBanksOpen && (
        <div
          role="dialog"
          aria-label="Disponible por banco"
          className="absolute left-0 top-[calc(100%+8px)] z-50 w-72 rounded-lg border border-slate-200 bg-white p-2 shadow-xl"
        >
          <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Disponible por banco
          </p>
          <div className="space-y-1">
            {bankItems.map((bank) => {
              const style = HEALTH_STYLES[bank.balanceStatus];
              const labelText = HEALTH_LABELS[bank.balanceStatus];
              return (
                <div
                  key={bank.bankId}
                  className={`flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-slate-50 ${style.bgClass ?? ""}`}
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      {bank.balanceStatus !== "normal" && (
                        <span
                          className={`inline-block h-1.5 w-1.5 rounded-full ${style.dotClass}`}
                          aria-hidden="true"
                        />
                      )}
                      <p className="text-xs font-semibold text-slate-900">
                        {bank.bankName}
                      </p>
                      {labelText && (
                        <span className={`text-[10px] font-medium ${style.labelClass}`}>
                          {labelText}
                        </span>
                      )}
                    </div>
                    {bank.reserved > 0 && (
                      <p className="text-[11px] text-slate-500">
                        {formatCurrency(bank.reserved)} reservado
                      </p>
                    )}
                  </div>
                  <p className={`text-sm font-semibold tabular-nums ${style.valueClass}`}>
                    {formatCurrency(bank.available)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryPopover({
  totals,
  bankItems,
  bankAlerts,
  hasAlerts,
}: {
  totals: ReturnType<typeof computeFinancialTotals>;
  bankItems: BankBreakdownItem[];
  bankAlerts: ConsolidatedAlert[];
  hasAlerts: boolean;
}) {
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const summaryButtonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setIsSummaryOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsSummaryOpen(false);
        summaryButtonRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const cashLabel = HEALTH_LABELS[totals.cashBalanceStatus];

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={summaryButtonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isSummaryOpen}
        onClick={() => setIsSummaryOpen((current) => !current)}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
      >
        <Wallet className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
        Resumen
        <ChevronDown
          className={`h-3 w-3 text-slate-400 transition-transform ${
            isSummaryOpen ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {isSummaryOpen && (
        <div
          role="dialog"
          aria-label="Resumen financiero"
          className="absolute left-0 top-[calc(100%+8px)] z-50 w-72 rounded-lg border border-slate-200 bg-white p-2 shadow-xl"
        >
          <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Resumen financiero
          </p>
          <div className="space-y-1">
            <SummaryRow label="Disponible total" value={totals.totalAvailable} emphasized />
            <SummaryRow
              label="Caja"
              value={totals.cashAvailable}
              secondary={cashLabel || undefined}
            />
            {bankItems.map((bank) => {
              const labelText = HEALTH_LABELS[bank.balanceStatus];
              return (
                <SummaryRow
                  key={bank.bankId}
                  label={bank.bankName}
                  value={bank.available}
                  secondary={[
                    labelText || "",
                    bank.reserved > 0 ? `${formatCurrency(bank.reserved)} reservado` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")
                    .trim() || undefined}
                />
              );
            })}
          </div>
          {hasAlerts && (
            <div className="mt-2 border-t border-slate-100 pt-2">
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Alertas
              </p>
              {bankAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-start gap-2 rounded-lg px-3 py-2 ${
                    alert.severity === "critical" ? "bg-red-50" : "bg-amber-50"
                  }`}
                >
                  {alert.icon === "balance" ? (
                    <Wallet
                      className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                        alert.severity === "critical"
                          ? "text-red-500"
                          : "text-amber-600"
                      }`}
                      aria-hidden="true"
                    />
                  ) : (
                    <Landmark
                      className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                        alert.severity === "critical"
                          ? "text-red-500"
                          : "text-amber-600"
                      }`}
                      aria-hidden="true"
                    />
                  )}
                  <div>
                    <p className="text-xs font-semibold text-slate-900">
                      {alert.title}
                    </p>
                    <p className="text-[11px] text-slate-600">{alert.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  emphasized = false,
  secondary,
}: {
  label: string;
  value: number;
  emphasized?: boolean;
  secondary?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-slate-50">
      <div>
        <p className={`text-xs ${emphasized ? "font-bold text-slate-950" : "font-semibold text-slate-900"}`}>
          {label}
        </p>
        {secondary && <p className="text-[11px] text-slate-500">{secondary}</p>}
      </div>
      <p className={`text-sm tabular-nums ${emphasized ? "font-bold text-slate-950" : "font-semibold text-slate-900"}`}>
        {formatCurrency(value)}
      </p>
    </div>
  );
}

function Divider() {
  return <span className="h-6 w-px shrink-0 bg-slate-200" aria-hidden="true" />;
}