import { BusinessFundsPage } from "@/components/business-funds/BusinessFundsPage";
import { OwnerOnlyGuard } from "@/components/guards/OwnerOnlyGuard";

export default function BusinessFundsRoute() {
  return (
    <OwnerOnlyGuard>
      <BusinessFundsPage />
    </OwnerOnlyGuard>
  );
}
