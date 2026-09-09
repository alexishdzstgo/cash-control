"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { useMockSession } from "@/components/session/MockSessionContext";

export function SessionGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { authenticatedUser } = useMockSession();

  useEffect(() => {
    if (!authenticatedUser) {
      router.replace("/workstation");
    }
  }, [authenticatedUser, router]);

  if (!authenticatedUser) {
    return null;
  }

  return <>{children}</>;
}
