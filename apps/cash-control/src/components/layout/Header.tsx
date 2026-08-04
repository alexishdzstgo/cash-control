"use client";

import { GlobalFinancialStatus } from "./GlobalFinancialStatus";
import { UserParticipationMenu } from "@/components/participation/UserParticipationMenu";

export function Header() {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6">
      <div className="min-w-0 flex-1">
        <GlobalFinancialStatus />
      </div>

      <div className="shrink-0">
        <UserParticipationMenu />
      </div>
    </header>
  );
}
