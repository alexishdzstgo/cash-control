import { SessionGuard } from "@/components/guards/SessionGuard";
import { AppShell } from "@/components/layout/AppShell";

export default function ApplicationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionGuard>
      <AppShell>{children}</AppShell>
    </SessionGuard>
  );
}
