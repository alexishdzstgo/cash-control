import { AlertOctagon, AlertTriangle, Landmark, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { FinancialResourceView } from "@/lib/financialAlerts";

type BankAlertCardProps = {
  resource: FinancialResourceView;
};

const statusConfig = {
  normal: {
    label: "Normal",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dotClass: "bg-emerald-500",
  },
  warning: {
    label: "Atención",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
    dotClass: "bg-amber-500",
  },
  critical: {
    label: "Crítico",
    badgeClass: "border-red-200 bg-red-50 text-red-700",
    dotClass: "bg-red-500",
  },
};

export function BankAlertCard({ resource }: BankAlertCardProps) {
  const status = statusConfig[resource.status];
  const ResourceIcon = resource.type === "cash" ? Wallet : Landmark;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <ResourceIcon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-950">
              {resource.name}
            </h3>
            <p className="text-xs text-slate-500">
              {resource.type === "cash" ? "Caja física" : "Cuenta bancaria"}
            </p>
          </div>
        </div>

        <span
          className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${status.badgeClass}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${status.dotClass}`} />
          {status.label}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Metric label="Disponible" value={formatCurrency(resource.available)} />
        <Metric label="Reservado" value={formatCurrency(resource.reserved)} />
        <Metric
          label={resource.type === "cash" ? "Saldo físico" : "Saldo real"}
          value={formatCurrency(resource.realBalance)}
        />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Metric
          label="Umbral bajo"
          value={
            resource.lowBalanceThreshold !== undefined
              ? formatCurrency(resource.lowBalanceThreshold)
              : "No configurado"
          }
        />
        <Metric
          label="Umbral crítico"
          value={
            resource.criticalBalanceThreshold !== undefined
              ? formatCurrency(resource.criticalBalanceThreshold)
              : "No configurado"
          }
        />
      </div>

      {resource.visibleMovementLimit !== undefined &&
        resource.visibleMovementsUsed !== undefined && (
          <div className="mt-5 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase text-slate-400">
              Límite de movimientos visibles
            </p>
            <div className="mt-2 grid gap-3 text-sm sm:grid-cols-3">
              <Metric
                label="Límite"
                value={resource.visibleMovementLimit.toString()}
              />
              <Metric
                label="Usados"
                value={resource.visibleMovementsUsed.toString()}
              />
              <Metric
                label="Restantes"
                value={(resource.remainingVisibleMovements ?? 0).toString()}
              />
            </div>
          </div>
        )}

      <div className="mt-5 space-y-2">
        {resource.alerts.length > 0 ? (
          resource.alerts.map((alert) => {
            const Icon =
              alert.severity === "critical" ? AlertOctagon : AlertTriangle;
            return (
              <div
                key={`${alert.resourceId}-${alert.type}`}
                className={`flex items-start gap-2 rounded-lg px-3 py-2.5 ${
                  alert.severity === "critical" ? "bg-red-50" : "bg-amber-50"
                }`}
              >
                <Icon
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    alert.severity === "critical"
                      ? "text-red-600"
                      : "text-amber-600"
                  }`}
                  aria-hidden="true"
                />
                <p
                  className={`text-sm font-medium ${
                    alert.severity === "critical"
                      ? "text-red-800"
                      : "text-amber-800"
                  }`}
                >
                  {alert.reason}
                </p>
              </div>
            );
          })
        ) : (
          <p className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
            Sin alertas activas.
          </p>
        )}
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900 tabular-nums">
        {value}
      </p>
    </div>
  );
}
