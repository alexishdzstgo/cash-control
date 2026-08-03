import { DepositPage } from "@/components/deposits/DepositPage";
import { AppShell } from "@/components/layout/AppShell";
import { ParticipationGuard } from "@/components/participation/ParticipationGuard";

export default function DepositsRoute() {
  return (
    <AppShell>
      <ParticipationGuard>
        <DepositPage />
      </ParticipationGuard>
    </AppShell>
  );
}
