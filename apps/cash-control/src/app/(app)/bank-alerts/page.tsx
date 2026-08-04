import { BankAlertsPage } from "@/components/bank-alerts/BankAlertsPage";
import { OwnerOnlyGuard } from "@/components/guards/OwnerOnlyGuard";

export default function BankAlertsRoute() {
  return (
    <OwnerOnlyGuard>
      <BankAlertsPage />
    </OwnerOnlyGuard>
  );
}
