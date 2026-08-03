import { AppShell } from "@/components/layout/AppShell";
import { ShiftsPage } from "@/components/shifts/ShiftsPage";

export default function ShiftsRoute() {
  return (
    <AppShell>
      <ShiftsPage />
    </AppShell>
  );
}