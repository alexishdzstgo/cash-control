"use client";

import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { OwnerGreeting } from "./OwnerGreeting";
import { OwnerQuickActions } from "./OwnerQuickActions";
import { BusinessHealthPanel } from "./BusinessHealthPanel";
import { OwnerFinancialOverview } from "./OwnerFinancialOverview";
import { FinancialResourcesPanel } from "./FinancialResourcesPanel";
import { OwnerAttentionPanel } from "./OwnerAttentionPanel";
import { OwnerShiftOverview } from "./OwnerShiftOverview";
import { ProfitSummary } from "./ProfitSummary";
import { AuditSummary } from "./AuditSummary";
import { EmployeePerformanceSummary } from "./EmployeePerformanceSummary";
import { OperationalConfigurationSummary } from "./OperationalConfigurationSummary";

export function OwnerControlCenter() {
  return (
    <div className="app-dashboard-bg space-y-8">
      <OwnerGreeting />

      <OwnerQuickActions />

      {/* Fila 1: Estado del negocio */}
      <BusinessHealthPanel />

      {/* Fila 2: Resumen financiero (2/3) + Turno (1/3) */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <OwnerFinancialOverview />
        </div>
        <OwnerShiftOverview />
      </div>

      {/* Fila 3: Caja y bancos (2/3) + Pendientes (1/3) */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FinancialResourcesPanel />
        </div>
        <OwnerAttentionPanel />
      </div>

      {/* Fila 4: Ganancia (1/2) + Auditoría (1/2) */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ProfitSummary />
        <AuditSummary />
      </div>

      {/* Fila 5: Personal (1/2) + Configuración (1/2) */}
      <div className="grid gap-6 lg:grid-cols-2">
        <EmployeePerformanceSummary />
        <OperationalConfigurationSummary />
      </div>

      {/* Fila 6: Actividad importante */}
      <ActivityFeed />
    </div>
  );
}