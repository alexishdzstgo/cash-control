import { Eye } from "lucide-react";
import type { FinancialResourceView } from "@/lib/financialAlerts";

type MovementVisibilityPanelProps = {
  resources: FinancialResourceView[];
};

export function MovementVisibilityPanel({
  resources,
}: MovementVisibilityPanelProps) {
  const bankResources = resources.filter(
    (resource) =>
      resource.type === "bank" &&
      resource.visibleMovementLimit !== undefined &&
      resource.visibleMovementsUsed !== undefined,
  );

  if (bankResources.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <Eye className="h-4 w-4 text-surface-text-label" aria-hidden="true" />
        <div>
          <h2 className="text-lg font-semibold text-surface-text-primary">
            Movimientos visibles
          </h2>
          <p className="mt-0.5 text-sm text-surface-text-secondary">
            Progreso por banco antes de alcanzar el límite visible.
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {bankResources.map((resource) => {
          const limit = resource.visibleMovementLimit ?? 0;
          const used = resource.visibleMovementsUsed ?? 0;
          const remaining = resource.remainingVisibleMovements ?? 0;
          const percent = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
          const tone = getMovementTone(resource, remaining);

          return (
            <article
              key={resource.id}
              className="rounded-lg border border-surface-border bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-surface-text-primary">
                    {resource.name}
                  </h3>
                  <p className="mt-1 text-sm text-surface-text-secondary">
                    {used} / {limit} utilizados
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${tone.badge}`}
                >
                  Quedan {remaining}
                </span>
              </div>

              <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${tone.bar}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="mt-3 text-xs text-surface-text-secondary">
                {tone.label}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function getMovementTone(
  resource: FinancialResourceView,
  remaining: number,
): { badge: string; bar: string; label: string } {
  if (remaining <= 0) {
    return {
      badge: "border-red-200 bg-red-50 text-red-700",
      bar: "bg-red-500",
      label: "Límite alcanzado.",
    };
  }

  if (
    resource.movementWarningRemaining !== undefined &&
    remaining <= resource.movementWarningRemaining
  ) {
    return {
      badge: "border-amber-200 bg-amber-50 text-amber-700",
      bar: "bg-amber-500",
      label: "Cerca del límite configurado.",
    };
  }

  return {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    bar: "bg-emerald-500",
    label: "Dentro del rango normal.",
  };
}
