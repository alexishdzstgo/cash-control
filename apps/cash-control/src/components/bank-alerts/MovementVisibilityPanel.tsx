import { Eye } from "lucide-react";
import type { FinancialResourceView } from "@/lib/financialAlerts";

type MovementVisibilityPanelProps = {
  resources: FinancialResourceView[];
};

export function MovementVisibilityPanel({
  resources,
}: MovementVisibilityPanelProps) {
  const bankResources = resources.filter(
    (resource) => resource.type === "bank" && resource.visibleMovementLimit,
  );

  if (bankResources.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-5">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-slate-950">
            Movimientos visibles
          </h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Control visual de límites bancarios configurados.
        </p>
      </div>

      <div className="divide-y divide-slate-100">
        {bankResources.map((resource) => {
          const limit = resource.visibleMovementLimit ?? 0;
          const used = resource.visibleMovementsUsed ?? 0;
          const percent = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

          return (
            <div key={resource.id} className="px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {resource.name}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {used} usados de {limit} visibles
                  </p>
                </div>
                <p className="text-sm font-semibold text-slate-700 tabular-nums">
                  {resource.remainingVisibleMovements ?? 0} restantes
                </p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${
                    resource.status === "critical"
                      ? "bg-red-500"
                      : resource.status === "warning"
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                  }`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
