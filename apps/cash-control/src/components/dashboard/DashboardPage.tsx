import { ActivityFeed } from "./ActivityFeed";
import { DashboardGreeting } from "./DashboardGreeting";
import { QuickActions } from "./QuickActions";
import { StatsGrid } from "./StatsGrid";

export function DashboardPage() {
  return (
    <div>
      <DashboardGreeting />

      <div className="mb-8">
        <QuickActions />
      </div>

      <StatsGrid />

      <ActivityFeed />
    </div>
  );
}