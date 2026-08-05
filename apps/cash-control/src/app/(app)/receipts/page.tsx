import { OwnerOnlyGuard } from "@/components/guards/OwnerOnlyGuard";
import { ReceiptsSettingsPage } from "@/components/receipts/ReceiptsSettingsPage";

export default function ReceiptsRoute() {
  return (
    <OwnerOnlyGuard>
      <ReceiptsSettingsPage />
    </OwnerOnlyGuard>
  );
}
