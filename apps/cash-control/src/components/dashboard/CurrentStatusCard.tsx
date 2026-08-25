"use client";

import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useFinancialAlerts } from "@/components/bank-alerts/FinancialAlertsContext";

const statusConfig = {
  normal: {
    icon: CheckCircle2,
    borderClass: "border-emerald-200",
    bgClass: "bg-emerald-50/50",
    iconClass: "text-emerald-600",
    titleClass: "text-emerald-900",
  },
  warning: {
    icon: AlertTriangle,
    borderClass: "border-amber-200",
    bgClass: "bg-amber-50/50",
    iconClass: "text-amber-600",
    titleClass: "text-amber-900",
  },
  critical: {
    icon: AlertOctagon,
    borderClass: "border-red-200",
    bgClass: "bg-red-50/50",
    iconClass: "text-red-600",
    titleClass: "text-red-900",
  },
};

export function CurrentStatusCard() {
  const { overview } = useFinancialAlerts();
  const relevantAlerts = useMemo(
    () =>
      overview.alerts
        .filter((alert) => alert.type !== "movement_limit_warning")
        .sort((a, b) => {
          if (a.severity === b.severity) return 0;
          return a.severity === "critical" ? -1 : 1;
        }),
    [overview.alerts],
  );
  const hasCritical = relevantAlerts.some(
    (alert) => alert.severity === "critical",
  );
  const status =
    relevantAlerts.length === 0
      ? "normal"
      : hasCritical
        ? "critical"
        : "warning";
  const config = statusConfig[status];
  const StatusIcon = config.icon;
  const title =
    relevantAlerts.length === 0
      ? "Todo en orden."
      : `${relevantAlerts.length} ${
          relevantAlerts.length === 1
            ? "situación requiere"
            : "situaciones requieren"
        } atención.`;
  const description =
    relevantAlerts.length === 0
      ? "No hay situaciones que requieran atención."
      : getStatusDescription(relevantAlerts.length, hasCritical);

  return (
    <section
      className={`rounded-xl border ${config.borderClass} ${config.bgClass} p-5`}
      aria-label="Estado actual"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ${config.iconClass}`}
          >
            <StatusIcon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-700">
              Estado actual
            </p>
            <h2 className={`mt-1 text-lg font-semibold ${config.titleClass}`}>
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{description}</p>

            {relevantAlerts.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {relevantAlerts.slice(0, 3).map((alert) => (
                  <li
                    key={`${alert.resourceId}-${alert.type}`}
                    className="flex items-start gap-2 text-sm"
                  >
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                        alert.severity === "critical"
                          ? "bg-red-500"
                          : "bg-amber-500"
                      }`}
                      aria-hidden="true"
                    />
                    <span className="text-slate-700">
                      {getAlertSummary(alert)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {relevantAlerts.length > 0 && (
          <Link
            href="/bank-alerts"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Revisar alertas
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </div>
    </section>
  );
}

function getStatusDescription(
  alertCount: number,
  hasCritical: boolean,
): string {
  if (alertCount === 1) {
    return hasCritical
      ? "Hay un recurso en estado crítico."
      : "Hay un recurso con saldo bajo.";
  }

  return hasCritical
    ? "Revisa los recursos críticos y las situaciones pendientes."
    : "Revisa los recursos con saldo bajo y movimientos pendientes.";
}

function getAlertSummary(
  alert: import("@/lib/financialAlerts").FinancialAlert,
): string {
  if (alert.type === "critical_balance") {
    return `${alert.resourceName} tiene saldo crítico.`;
  }
  if (alert.type === "low_balance") {
    return `${alert.resourceName} tiene poco saldo disponible.`;
  }
  if (alert.type === "movement_limit_reached") {
    return `${alert.resourceName} alcanzó el límite de movimientos visibles.`;
  }
  return `${alert.resourceName} está cerca del límite de movimientos visibles.`;
}
