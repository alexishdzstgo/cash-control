"use client";

import { UserParticipationMenu } from "@/components/participation/UserParticipationMenu";

export function Header() {
  return (
    <header className="flex h-16 shrink-0 items-center justify-end border-b border-brand-border bg-white px-6">
      <UserParticipationMenu />
    </header>
  );
}
