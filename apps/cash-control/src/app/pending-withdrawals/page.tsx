import { AppShell } from "@/components/layout/AppShell";
import { PendingWithdrawalsPage } from "@/components/withdrawals/PendingWithdrawalsPage";
import { ParticipationGuard } from "@/components/participation/ParticipationGuard";

export default function PendingWithdrawalsRoute() {
  return (
    <AppShell>
      <ParticipationGuard>
        <PendingWithdrawalsPage />
      </ParticipationGuard>
    </AppShell>
  );
}
