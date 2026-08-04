import { WithdrawalPage } from "@/components/withdrawals/WithdrawalPage";
import { ParticipationGuard } from "@/components/participation/ParticipationGuard";

export default function WithdrawalsRoute() {
  return (
    <ParticipationGuard>
      <WithdrawalPage />
    </ParticipationGuard>
  );
}