import { CommissionsPage } from "@/components/commissions/CommissionsPage";
import { OwnerOnlyGuard } from "@/components/guards/OwnerOnlyGuard";

export default function CommissionsRoute() {
  return (
    <OwnerOnlyGuard>
      <CommissionsPage />
    </OwnerOnlyGuard>
  );
}
