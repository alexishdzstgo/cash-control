import { Landmark, Wallet, Lock } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { cashBalance, bankAccounts } from "@/components/balances/balanceMockData";

function computeTotals() {
  const totalCashPhysical = cashBalance.physicalBalance;
  const totalCashReserved = cashBalance.reservedOperations.reduce(
    (sum, op) => sum + op.amount,
    0
  );
  const totalBankReal = bankAccounts.reduce(
    (sum, b) => sum + b.realBalance,
    0
  );
  const totalBankReserved = bankAccounts.reduce(
    (sum, b) =>
      sum +
      b.reservedOperations.reduce((ops, op) => ops + op.amount, 0),
    0
  );

  const totalControlled = totalCashPhysical + totalBankReal;
  const totalReserved = totalCashReserved + totalBankReserved;
  const totalAvailable = totalControlled - totalReserved;

  return { totalControlled, totalReserved, totalAvailable, totalCashPhysical, totalBankReal };
}

export function CashHero() {
  const { totalControlled, totalReserved, totalAvailable, totalCashPhysical, totalBankReal } = computeTotals();

  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="absolute inset-y-0 left-0 w-1 bg-brand-primary" aria-hidden="true" />

      <div className="p-8">
        <p className="text-sm font-medium text-slate-500">
          Dinero total controlado
        </p>

        <p className="mt-3 text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">
          {formatCurrency(totalControlled)}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Wallet className="h-4 w-4 text-slate-400" />
            <span>
              Caja:{" "}
              <span className="font-semibold text-slate-900 tabular-nums">
                {formatCurrency(totalCashPhysical)}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Landmark className="h-4 w-4 text-slate-400" />
            <span>
              Bancos:{" "}
              <span className="font-semibold text-slate-900 tabular-nums">
                {formatCurrency(totalBankReal)}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-amber-700">
            <Lock className="h-4 w-4" />
            <span>
              Reservado:{" "}
              <span className="font-semibold tabular-nums">
                {formatCurrency(totalReserved)}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-emerald-700">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span>
              Disponible:{" "}
              <span className="font-semibold tabular-nums">
                {formatCurrency(totalAvailable)}
              </span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}