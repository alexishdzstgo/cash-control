import { AppShell } from "@/components/layout/AppShell";
import { WithdrawalPage } from "@/components/withdrawals/WithdrawalPage";

export default function WithdrawalsRoute() {
  return (
    <AppShell>
      <WithdrawalPage />
    </AppShell>
  );
}