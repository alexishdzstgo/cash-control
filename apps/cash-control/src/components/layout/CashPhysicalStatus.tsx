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
      <p className="text-[10px] font-medium leading-3 text-slate-500">
        Caja física
      </p>
      <p className="text-sm font-semibold leading-4 text-slate-900">
        {formatCurrency(totals.cashPhysical)}
      </p>
      <dl className="mt-1 grid grid-cols-2 gap-x-3 text-[10px] leading-3">
        <div
          className={
            status === "critical"
              ? "text-red-700"
              : status === "warning"
                ? "text-amber-700"
                : "text-slate-600"
          }
        >
          <dt>
            Disponible
            <span className="sr-only">
              {status === "critical"
                ? " · Crítico"
                : status === "warning"
                  ? " · Atención"
                  : ""}
            </span>
          </dt>
          <dd className="font-semibold">
            {formatCurrency(totals.cashAvailable)}
          </dd>
        </div>
        <div className="text-violet-600">
          <dt>Apartado</dt>
          <dd className="font-semibold">
            {formatCurrency(totals.cashReserved)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
