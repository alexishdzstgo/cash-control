import { Landmark, Lock, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { computeFinancialTotals } from "@/lib/finance";

export function CashHero() {
  const totals = computeFinancialTotals();

  return (
    <section className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="absolute inset-y-0 left-0 w-1 bg-[#2563EB]" aria-hidden="true" />
      <div className="p-8 md:p-10">
        <p className="text-sm font-medium text-slate-500">Disponible para operar</p>
        <p className="mt-3 amount-hero text-slate-900">{formatCurrency(totals.totalAvailable)}</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <p className="text-sm text-slate-500">Caja disponible</p>
            </div>
            <p className="mt-2 text-xl font-semibold text-slate-900 tabular-nums">{formatCurrency(totals.cashAvailable)}</p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-4">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <p className="text-sm text-slate-500">Bancos disponibles</p>
            </div>
            <p className="mt-2 text-xl font-semibold text-slate-900 tabular-nums">{formatCurrency(totals.banksAvailable)}</p>
          </div>
          <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-4">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-amber-500" aria-hidden="true" />
              <p className="text-sm text-amber-700">Reservado</p>
            </div>
            <p className="mt-2 text-xl font-semibold text-amber-800 tabular-nums">{formatCurrency(totals.totalReserved)}</p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-4">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <p className="text-sm text-slate-500">Total controlado</p>
            </div>
            <p className="mt-2 text-xl font-semibold text-slate-900 tabular-nums">{formatCurrency(totals.totalControlled)}</p>
          </div>
        </div>
      </div>
    </section>
  );
}