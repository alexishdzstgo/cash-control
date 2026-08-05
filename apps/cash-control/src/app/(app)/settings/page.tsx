import { OwnerOnlyGuard } from "@/components/guards/OwnerOnlyGuard";
import { SettingsPage } from "@/components/settings/SettingsPage";

export default function SettingsRoute() {
  return (
    <OwnerOnlyGuard>
      <SettingsPage />
    </OwnerOnlyGuard>
  );
}
