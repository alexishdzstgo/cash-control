import { AppShell } from "@/components/layout/AppShell";
import { PendingWithdrawalsPage } from "@/components/withdrawals/PendingWithdrawalsPage";

export default function PendingWithdrawalsRoute() {
  return (
    <AppShell>
      <PendingWithdrawalsPage />
    </AppShell>
  );
}