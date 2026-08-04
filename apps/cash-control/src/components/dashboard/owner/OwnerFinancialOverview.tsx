"use client";

import { Landmark, Lock, Wallet, ArrowRight } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/formatters";
import { computeFinancialTotals } from "@/lib/finance";

export function OwnerFinancialOverview() {
  const totals = computeFinancialTotals();

  return (
    <section className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="absolute inset-y-0 left-0 w-1 bg-[#2563EB]" aria-hidden="true" />
      <div className="p-6 md:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Disponible para operar</p>
            <p className="mt-2 amount-hero text-slate-900">
              {formatCurrency(totals.totalAvailable)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/balances"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Caja y bancos
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            <Link
              href="/pending-withdrawals"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Ver reservas
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <p className="text-sm text-slate-500">Caja disponible</p>
            </div>
            <p className="mt-2 text-xl font-semibold text-slate-900 tabular-nums">
              {formatCurrency(totals.cashAvailable)}
            </p>
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-4">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <p className="text-sm text-slate-500">Bancos disponibles</p>
            </div>
            <p className="mt-2 text-xl font-semibold text-slate-900 tabular-nums">
              {formatCurrency(totals.banksAvailable)}
            </p>
          </div>

          <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-4">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-amber-500" aria-hidden="true" />
              <p className="text-sm text-amber-700">Reservado</p>
            </div>
            <p className="mt-2 text-xl font-semibold text-amber-800 tabular-nums">
              {formatCurrency(totals.totalReserved)}
            </p>
            <p className="mt-1 text-xs text-amber-700">
              Caja {formatCurrency(totals.cashReserved)} · Bancos{" "}
              {formatCurrency(totals.banksReserved)}
            </p>
          </div>
        </div>

        <p className="mt-4 text-xs text-slate-400">
          Total controlado:{" "}
          <span className="font-semibold text-slate-600 tabular-nums">
            {formatCurrency(totals.totalControlled)}
          </span>{" "}
          (caja física + bancos)
        </p>
      </div>
    </section>
  );
}