import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { bankAccounts } from "@/components/balances/balanceMockData";
import { initialAdministrativeMovements } from "@/components/business-funds/businessFundsMockData";
import { createInitialCommissionRules } from "@/components/commissions/commissionMockData";
import { initialReceiptPreferences } from "@/components/receipts/receiptMockData";
import { initialUserAccounts } from "@/components/users/userMockData";
import { SettingsCard } from "./SettingsCard";

const moduleSummaries = [
  {
    label: "Comisiones",
    detail: `${createInitialCommissionRules().length} reglas activas`,
    href: "/commissions",
  },
  {
    label: "Usuarios",
    detail: `${initialUserAccounts.length} cuentas mock`,
    href: "/users",
  },
  {
    label: "Bancos y alertas",
    detail: `${bankAccounts.length} bancos configurados`,
    href: "/bank-alerts",
  },
  {
    label: "Comprobantes",
    detail: `${initialReceiptPreferences.copies} copia predeterminada`,
    href: "/receipts",
  },
  {
    label: "Fondos del negocio",
    detail: `${initialAdministrativeMovements.length} movimientos mock`,
    href: "/business-funds",
  },
];

export function ModulesSummaryCard() {
  return (
    <SettingsCard
      title="Resumen de módulos"
      description="Accesos a configuraciones operativas que ya existen en el MVP."
    >
      <div className="space-y-3">
        {moduleSummaries.map((module) => (
          <div
            key={module.href}
            className="flex flex-col gap-3 rounded-lg border border-slate-100 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {module.label}
              </p>
              <p className="mt-1 text-sm text-slate-500">{module.detail}</p>
            </div>
            <Link href={module.href} className="btn-secondary w-full sm:w-auto">
              Administrar
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ))}
      </div>
    </SettingsCard>
  );
}
