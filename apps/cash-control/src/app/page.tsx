import { DashboardPage } from "@/components/dashboard/DashboardPage";
import { AppShell } from "@/components/layout/AppShell";

export default function Home() {
  return (
    <AppShell>
      <DashboardPage />
    </AppShell>
  );
}