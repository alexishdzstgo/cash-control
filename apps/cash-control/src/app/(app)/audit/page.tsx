import { AuditPage } from "@/components/audit/AuditPage";
import { OwnerOnlyGuard } from "@/components/guards/OwnerOnlyGuard";
import { mockOperations } from "@/components/history/mockOperations";

export default function AuditRoute() {
  return (
    <OwnerOnlyGuard>
      <AuditPage operations={mockOperations} />
    </OwnerOnlyGuard>
  );
}
