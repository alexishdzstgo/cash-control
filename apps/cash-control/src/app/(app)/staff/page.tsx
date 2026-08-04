import { OwnerOnlyGuard } from "@/components/guards/OwnerOnlyGuard";
import { StaffPage } from "@/components/staff/StaffPage";

export default function StaffRoute() {
  return (
    <OwnerOnlyGuard>
      <StaffPage />
    </OwnerOnlyGuard>
  );
}
