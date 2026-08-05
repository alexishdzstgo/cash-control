"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useBusinessFunds } from "@/components/business-funds/BusinessFundsContext";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  computeBankMovementAlertsFromBanks,
  computeFinancialTotalsFromBalances,
} from "@/lib/finance";
import { getFinancialAlertsOverview } from "@/lib/financialAlerts";
import { AlertConfigurationSummary } from "./AlertConfigurationSummary";
import { BankAlertCard } from "./BankAlertCard";
import { FinancialAlertsSummary } from "./FinancialAlertsSummary";
import { MovementVisibilityPanel } from "./MovementVisibilityPanel";

export function BankAlertsPage() {
  const { cash, banks } = useBusinessFunds();
  const totals = computeFinancialTotalsFromBalances({ cash, banks });
  const movementAlerts = computeBankMovementAlertsFromBanks(banks);
  const overview = getFinancialAlertsOverview({
    cash,
    banks,
    totals,
    movementAlerts,
  });

  return (
    <div>
      <PageHeader
        title="Bancos y alertas"
        description="Supervisa saldos mínimos, límites visibles y situaciones que requieren atención."
        action={
          <Link
            href="/balances"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Ver Caja y bancos
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        }
      />

      <div className="space-y-6">
        <FinancialAlertsSummary overview={overview} />

        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Recursos supervisados
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Estado actual de caja física y bancos configurados.
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {overview.resources.map((resource) => (
              <BankAlertCard key={resource.id} resource={resource} />
            ))}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <AlertConfigurationSummary resources={overview.resources} />
          <MovementVisibilityPanel resources={overview.resources} />
        </div>
      </div>
    </div>
  );
}
