"use client";

import { CheckCircle2, AlertTriangle, AlertOctagon, ArrowRight } from "lucide-react";
import Link from "next/link";
import { computeBusinessHealth, type BusinessHealthStatus } from "@/lib/businessHealth";

const statusConfig: Record<
  BusinessHealthStatus,
  {
    icon: typeof CheckCircle2;
    borderClass: string;
    bgClass: string;
    iconClass: string;
    titleClass: string;
  }
> = {
  stable: {
    icon: CheckCircle2,
    borderClass: "border-emerald-200",
    bgClass: "bg-emerald-50/50",
    iconClass: "text-emerald-600",
    titleClass: "text-emerald-900",
  },
  attention: {
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

export function BusinessHealthPanel() {
  const health = computeBusinessHealth();
  const config = statusConfig[health.status];
  const StatusIcon = config.icon;

  return (
    <section
      className={`rounded-xl border ${config.borderClass} ${config.bgClass} p-5`}
      aria-label="Estado del negocio"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ${config.iconClass}`}
          >
            <StatusIcon className="h-5 w-5" aria-hidden="true" />
          </div>

          <div>
            <h2 className={`text-lg font-semibold ${config.titleClass}`}>
              {health.title}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{health.description}</p>

            {health.causes.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {health.causes.map((cause) => (
                  <li key={cause.id} className="flex items-start gap-2 text-sm">
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                        cause.severity === "critical" ? "bg-red-500" : "bg-amber-500"
                      }`}
                      aria-hidden="true"
                    />
                    <span className="text-slate-700">{cause.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {health.status !== "stable" && (
          <Link
            href="/balances"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Revisar detalles
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </div>
    </section>
  );
}