import type { FinancialResourceStatus, FinancialTotals } from "@/lib/finance";
import { formatCurrency } from "@/lib/formatters";

export function CashPhysicalStatus({
  totals,
  status = totals.cashBalanceStatus,
}: {
  totals: FinancialTotals;
  status?: FinancialResourceStatus;
}) {
  const isNegative = totals.cashAvailable < 0;
  return (
    <div className="shrink-0 px-1.5 tabular-nums">
      <p className="text-center text-[9px] font-medium uppercase leading-3 tracking-wide text-slate-500">
        Caja física
      </p>
      <dl className="mt-1 flex items-center gap-x-1 text-[10px] leading-3">
        <div className={`rounded-md px-2 py-1 ${isNegative || status === "critical" ? "bg-red-50/70" : status === "warning" ? "bg-amber-50/70" : "bg-emerald-50/70"}`}>
          <dt className="font-medium uppercase tracking-wide text-slate-500">
            Disponible
            <span className="sr-only">
              {isNegative || status === "critical"
                ? " · Crítico"
                : status === "warning"
                  ? " · Atención"
                  : ""}
            </span>
          </dt>
          <dd
            title={
              isNegative
                ? "Existe un faltante de efectivo respecto al dinero apartado."
                : undefined
            }
            className="text-sm font-semibold leading-4 text-slate-950"
          >
            {formatCurrency(totals.cashAvailable)}
          </dd>
        </div>
        <div className="border-l border-slate-200 pl-2 py-1">
          <dt className="font-medium uppercase tracking-wide text-slate-500">
            Apartado
          </dt>
          <dd className="text-sm font-semibold leading-4 text-slate-950">
            {formatCurrency(totals.cashReserved)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
