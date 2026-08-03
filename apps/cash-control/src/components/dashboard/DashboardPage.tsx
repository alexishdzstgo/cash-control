"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ActivityFeed } from "./ActivityFeed";
import { CashHero } from "./CashHero";
import { DashboardGreeting } from "./DashboardGreeting";
import { HealthAlerts } from "./HealthAlerts";
import { QuickActions } from "./QuickActions";
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

  return (
    <div className="space-y-8">
      <DashboardGreeting />

      <CashHero />

      <HealthAlerts />

      <ActivityFeed />

      <QuickActions />
    </div>
  );
}