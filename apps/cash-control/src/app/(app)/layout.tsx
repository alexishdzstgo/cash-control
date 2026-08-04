import { AppShell } from "@/components/layout/AppShell";

export default function ApplicationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}