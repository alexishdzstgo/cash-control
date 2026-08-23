import { Landmark, Wallet } from "lucide-react";
import type { FinancialResourceView } from "@/lib/financialAlerts";
import { formatCurrency } from "@/lib/formatters";

type BankAlertCardProps = {
  resource: FinancialResourceView;
  showAmounts: boolean;
};

const statusConfig = {
  normal: {
    label: "Correcto",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    accentClass: "border-l-emerald-400",
  },
  warning: {
    label: "Atención",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
    accentClass: "border-l-amber-400",
  },
  critical: {
    label: "Crítico",
    badgeClass: "border-red-200 bg-red-50 text-red-700",
    accentClass: "border-l-red-400",
  },
};

export function BankAlertCard({ resource, showAmounts }: BankAlertCardProps) {
  const status = statusConfig[resource.status];
  const ResourceIcon = resource.type === "cash" ? Wallet : Landmark;

  return (
    <article
      className={`rounded-lg border border-l-4 border-surface-border bg-white p-5 shadow-sm ${status.accentClass}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-neutral text-surface-text-label">
            <ResourceIcon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-surface-text-primary">
              {resource.name}
            </h3>
            <p className="text-xs text-surface-text-secondary">
              {resource.type === "cash" ? "Caja física" : "Cuenta bancaria"}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${status.badgeClass}`}
        >
          {status.label}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Metric
          label="Disponible para operar"
          value={
            showAmounts
              ? formatCurrency(resource.available)
              : getRestrictedValue(resource.status)
          }
        />
        <Metric
          label={
            resource.type === "cash"
              ? "Apartado para retiros"
              : "Apartado/reservado"
          }
          value={
            showAmounts ? formatCurrency(resource.reserved) : "Según permisos"
          }
        />
        <Metric label="Estado" value={status.label} />
      </div>

      {showAmounts && resource.lowBalanceThreshold !== undefined && (
        <p className="mt-4 rounded-lg bg-surface-neutral px-3 py-2 text-xs text-surface-text-secondary">
          Mínimo configurado:{" "}
          <span className="font-semibold text-surface-text-primary tabular-nums">
            {formatCurrency(resource.lowBalanceThreshold)}
          </span>
        </p>
      )}
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-surface-text-label">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-surface-text-primary tabular-nums">
        {value}
      </p>
    </div>
  );
}

function getRestrictedValue(status: FinancialResourceView["status"]): string {
  if (status === "normal") return "Suficiente";
  if (status === "critical") return "No usar sin revisión";
  return "Saldo disponible bajo";
}
