import { Wallet, Lock, Banknote } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { CashBalance, BankAccountBalance } from "@/types/balance";

function computeTotals(cash: CashBalance, banks: BankAccountBalance[]) {
  const totalCashPhysical = cash.physicalBalance;
  const totalCashReserved = cash.reservedOperations.reduce((sum, op) => sum + op.amount, 0);
  const totalBankReal = banks.reduce((sum, b) => sum + b.realBalance, 0);
  const totalBankReserved = banks.reduce(
    (sum, b) => sum + b.reservedOperations.reduce((ops, op) => ops + op.amount, 0),
    0,
  );
  const totalControlled = totalCashPhysical + totalBankReal;
  const totalReserved = totalCashReserved + totalBankReserved;
  const totalAvailable = totalControlled - totalReserved;
  return { totalControlled, totalReserved, totalAvailable };
}

type BalanceSummaryProps = {
  cash: CashBalance;
  banks: BankAccountBalance[];
};

export function BalanceSummary({ cash, banks }: BalanceSummaryProps) {
  const { totalControlled, totalReserved, totalAvailable } = computeTotals(cash, banks);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
        <div className="absolute inset-y-0 left-0 w-1 bg-[#2563EB]" aria-hidden="true" />
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB]">
            <Banknote className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-slate-500">Disponible para operar</p>
        </div>
        <p className="mt-4 amount-hero text-slate-900">{formatCurrency(totalAvailable)}</p>
        <p className="mt-2 text-sm text-slate-500">Efectivo y saldos bancarios sin comprometer</p>
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-100 pt-4 text-sm">
          <span className="text-slate-600">
            Total controlado: <span className="font-semibold text-slate-900 tabular-nums">{formatCurrency(totalControlled)}</span>
          </span>
          <span className="text-slate-600">
            Reservado: <span className="font-semibold text-amber-700 tabular-nums">{formatCurrency(totalReserved)}</span>
          </span>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-emerald-600" />
            <p className="text-sm font-medium text-slate-500">Disponible para operar</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-950 tabular-nums">{formatCurrency(totalAvailable)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-amber-600" />
            <p className="text-sm font-medium text-slate-500">Fondos reservados</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-950 tabular-nums">{formatCurrency(totalReserved)}</p>
        </div>
      </div>
    </div>
  );
}