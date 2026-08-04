import { DepositPage } from "@/components/deposits/DepositPage";
import { ParticipationGuard } from "@/components/participation/ParticipationGuard";

export default function DepositsRoute() {
  return (
    <ParticipationGuard>
      <DepositPage />
    </ParticipationGuard>
  );
}