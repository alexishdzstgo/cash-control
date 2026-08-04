import { ParticipationGuard } from "@/components/participation/ParticipationGuard";
import { BalancesPage } from "@/components/balances/BalancesPage";

export default function BalancesRoute() {
  return (
    <ParticipationGuard>
      <BalancesPage />
    </ParticipationGuard>
  );
}
