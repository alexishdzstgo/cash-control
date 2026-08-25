"use client";

import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { CurrentStatusCard } from "@/components/dashboard/CurrentStatusCard";
import { AuditSummary } from "./AuditSummary";
import { EmployeePerformanceSummary } from "./EmployeePerformanceSummary";
import { FinancialResourcesPanel } from "./FinancialResourcesPanel";
import { OperationalConfigurationSummary } from "./OperationalConfigurationSummary";
import { OwnerAttentionPanel } from "./OwnerAttentionPanel";
import { OwnerFinancialOverview } from "./OwnerFinancialOverview";
import { OwnerGreeting } from "./OwnerGreeting";
import { OwnerQuickActions } from "./OwnerQuickActions";
import { OwnerShiftOverview } from "./OwnerShiftOverview";
import { ProfitSummary } from "./ProfitSummary";

export function OwnerControlCenter() {
  return (
    <div className="space-y-8">
      <OwnerGreeting />

      <CurrentStatusCard />

      <OwnerQuickActions />

      <div className="grid min-w-0 gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <OwnerFinancialOverview />
        </div>
        <OwnerShiftOverview />
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <FinancialResourcesPanel />
        </div>
        <OwnerAttentionPanel />
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <ProfitSummary />
        <AuditSummary />
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <EmployeePerformanceSummary />
        <OperationalConfigurationSummary />
      </div>

      <ActivityFeed />
    </div>
  );
}
