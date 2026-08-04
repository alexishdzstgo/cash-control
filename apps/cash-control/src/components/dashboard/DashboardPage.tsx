"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ActivityFeed } from "./ActivityFeed";
import { CashHero } from "./CashHero";
import { DashboardGreeting } from "./DashboardGreeting";
import { HealthAlerts } from "./HealthAlerts";
import { QuickActions } from "./QuickActions";
import { OwnerControlCenter } from "./owner/OwnerControlCenter";
import { useMockSession } from "@/components/session/MockSessionContext";

export function DashboardPage() {
  const router = useRouter();
  const { authenticatedUser } = useMockSession();

  useEffect(() => {
    if (!authenticatedUser) {
      router.replace("/workstation");
    }
  }, [authenticatedUser, router]);

  if (!authenticatedUser) {
    return null;
  }

  const isOwner = authenticatedUser.systemRole === "owner";

  // ── Owner: Centro de Control ejecutivo ──
  if (isOwner) {
    return <OwnerControlCenter />;
  }

  // ── Employee: Dashboard operativo conservado ──
  return (
    <div className="app-dashboard-bg space-y-8">
      <DashboardGreeting />

      <QuickActions />

      <HealthAlerts />

      <ActivityFeed />
    </div>
  );
}