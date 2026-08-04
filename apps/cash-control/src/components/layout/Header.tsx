"use client";

import { GlobalFinancialStatus } from "./GlobalFinancialStatus";
import { UserParticipationMenu } from "@/components/participation/UserParticipationMenu";

export function Header() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
      <GlobalFinancialStatus />

      <UserParticipationMenu />
    </header>
  );
}