import type { ShiftActivitySummary as Summary } from "@/types/shift";

const labels: Record<keyof Summary, string> = {
  deposits: "Depósitos",
  withdrawals: "Retiros",
  pendingWithdrawals: "Retiros pendientes",
  fundsMovements: "Movimientos de fondos",
  corrections: "Correcciones",
  clarifications: "Aclaraciones",
};

export function ShiftActivitySummary({ summary }: { summary: Summary }) {
  return (
    <section className="rounded-xl border border-brand-border bg-white p-6">
      <h3 className="text-lg font-semibold text-slate-900">
        Actividad del turno
      </h3>
      <dl className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {(Object.keys(labels) as Array<keyof Summary>).map((key) => (
          <div key={key}>
            <dt className="text-xs font-medium text-slate-500">
              {labels[key]}
            </dt>
            <dd className="mt-1 text-xl font-semibold text-slate-900 tabular-nums">
              {summary[key]}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
