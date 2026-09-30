"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMockSession } from "@/components/session/MockSessionContext";
import { ActivityFeed } from "./ActivityFeed";
import { CurrentStatusCard } from "./CurrentStatusCard";
import { DashboardGreeting } from "./DashboardGreeting";
import { HealthAlerts } from "./HealthAlerts";
import { OwnerControlCenter } from "./owner/OwnerControlCenter";
import { QuickActions } from "./QuickActions";

export function DashboardPage() {
  const router = useRouter();
  const { authenticatedUser, isSessionLoading } = useMockSession();

  useEffect(() => {
    if (!isSessionLoading && !authenticatedUser) {
      router.replace("/workstation");
    }
  }, [authenticatedUser, isSessionLoading, router]);

  if (isSessionLoading || !authenticatedUser) {
    return null;
  }

  const isOwner = authenticatedUser.systemRole === "owner";

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
