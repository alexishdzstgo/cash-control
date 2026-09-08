import type { FinancialResourceStatus, FinancialTotals } from "@/lib/finance";
import { formatCurrency } from "@/lib/formatters";

export function CashPhysicalStatus({
  totals,
  status = totals.cashBalanceStatus,
}: {
  totals: FinancialTotals;
  status?: FinancialResourceStatus;
}) {
  return (
    <div className="shrink-0 px-1.5 tabular-nums">
      <p className="text-[9px] font-medium uppercase leading-3 tracking-wide text-slate-500">
        Caja física
      </p>
      <dl className="mt-1 grid grid-cols-2 gap-x-3 text-[10px] leading-3">
        <div>
          <dt className="font-medium uppercase tracking-wide text-slate-500">
            Disponible
            <span className="sr-only">
              {status === "critical"
                ? " · Crítico"
                : status === "warning"
                  ? " · Atención"
                  : ""}
            </span>
          </dt>
          <dd
            className={`text-sm font-semibold leading-4 ${
              status === "critical"
                ? "text-red-700"
                : status === "warning"
                  ? "text-amber-700"
                  : "text-slate-800"
            }`}
          >
            {formatCurrency(totals.cashAvailable)}
          </dd>
        </div>
        <div className="border-l border-slate-200 pl-3">
          <dt className="font-medium uppercase tracking-wide text-slate-500">
            Apartado
          </dt>
          <dd className="text-sm font-semibold leading-4 text-slate-800">
            {formatCurrency(totals.cashReserved)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
