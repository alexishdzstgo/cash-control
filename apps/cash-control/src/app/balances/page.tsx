import { AppShell } from "@/components/layout/AppShell";
import { ParticipationGuard } from "@/components/participation/ParticipationGuard";
import { BalancesPage } from "@/components/balances/BalancesPage";

export default function BalancesRoute() {
  return (
    <AppShell>
      <ParticipationGuard>
        <BalancesPage />
      </ParticipationGuard>
    </AppShell>
  );
}