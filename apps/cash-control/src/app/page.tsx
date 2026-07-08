import { AppShell } from "@/components/layout/AppShell";
import { DepositPage } from "@/components/deposits/DepositPage";

export default function Home() {
  return (
    <AppShell>
      <DepositPage />
    </AppShell>
  );
}