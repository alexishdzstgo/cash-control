import { LockKeyhole } from "lucide-react";
import type { FinancialResourceView } from "@/lib/financialAlerts";
import { formatCurrency } from "@/lib/formatters";

type AlertConfigurationSummaryProps = {
  resources: FinancialResourceView[];
};

export function AlertConfigurationSummary({
  resources,
}: AlertConfigurationSummaryProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            Configuración de alertas
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Umbrales actuales de saldo bajo y crítico por recurso.
          </p>
        </div>
        <button
          type="button"
          disabled
          className="inline-flex min-h-10 w-fit cursor-not-allowed items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-400"
        >
          <LockKeyhole className="h-4 w-4" aria-hidden="true" />
          Editar configuración
        </button>
      </div>

      <div className="divide-y divide-slate-100">
        {resources.map((resource) => (
          <div
            key={resource.id}
            className="grid gap-3 px-6 py-4 text-sm sm:grid-cols-[1fr_auto_auto]"
          >
            <p className="font-medium text-slate-900">{resource.name}</p>
            <p className="text-slate-500">
              Bajo:{" "}
              <span className="font-semibold text-slate-800 tabular-nums">
                {resource.lowBalanceThreshold !== undefined
                  ? formatCurrency(resource.lowBalanceThreshold)
                  : "No configurado"}
              </span>
            </p>
            <p className="text-slate-500">
              Crítico:{" "}
              <span className="font-semibold text-slate-800 tabular-nums">
                {resource.criticalBalanceThreshold !== undefined
                  ? formatCurrency(resource.criticalBalanceThreshold)
                  : "No configurado"}
              </span>
            </p>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-100 px-6 py-4 text-xs text-slate-500">
        Disponible al conectar la base de datos.
      </div>
    </section>
  );
}
