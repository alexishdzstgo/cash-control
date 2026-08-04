import { PendingWithdrawalsPage } from "@/components/withdrawals/PendingWithdrawalsPage";
import { ParticipationGuard } from "@/components/participation/ParticipationGuard";

export default function PendingWithdrawalsRoute() {
  return (
    <ParticipationGuard>
      <PendingWithdrawalsPage />
    </ParticipationGuard>
  );
}