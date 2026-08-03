import { AppShell } from "@/components/layout/AppShell";
import { WithdrawalPage } from "@/components/withdrawals/WithdrawalPage";
import { ParticipationGuard } from "@/components/participation/ParticipationGuard";

export default function WithdrawalsRoute() {
  return (
    <AppShell>
      <ParticipationGuard>
        <WithdrawalPage />
      </ParticipationGuard>
    </AppShell>
  );
}
