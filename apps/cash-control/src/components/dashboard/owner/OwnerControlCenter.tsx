"use client";

import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { CurrentStatusCard } from "@/components/dashboard/CurrentStatusCard";
import { OwnerGreeting } from "./OwnerGreeting";
import { OwnerQuickActions } from "./OwnerQuickActions";

export function OwnerControlCenter() {
  return (
    <div className="space-y-8">
      <OwnerGreeting />

      <CurrentStatusCard />

      <OwnerQuickActions />

      <ActivityFeed />
    </div>
  );
}
