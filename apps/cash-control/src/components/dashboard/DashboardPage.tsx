"use client";

import { useRealAppSession } from "@/components/session/RealAppSessionProvider";
import { ActivityFeed } from "./ActivityFeed";
import { CurrentStatusCard } from "./CurrentStatusCard";
import { DashboardGreeting } from "./DashboardGreeting";
import { HealthAlerts } from "./HealthAlerts";
import { OwnerControlCenter } from "./owner/OwnerControlCenter";
import { QuickActions } from "./QuickActions";

export function DashboardPage() {
  const { state, operator } = useRealAppSession();

  if (state !== "ACTIVE" || !operator) {
    return null;
  }

  const isOwner = operator.identity.role === "owner";

  // ── Owner: Centro de Control ejecutivo ──
  if (isOwner) {
    return <OwnerControlCenter />;
  }

  // ── Employee: Dashboard operativo conservado ──
  return (
    <div className="space-y-8">
      <DashboardGreeting />

      <CurrentStatusCard />

      <QuickActions />

      <HealthAlerts />

      <ActivityFeed />
    </div>
  );
}