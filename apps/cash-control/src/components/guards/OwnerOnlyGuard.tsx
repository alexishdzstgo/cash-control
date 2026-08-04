"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useMockSession } from "@/components/session/MockSessionContext";

type OwnerOnlyGuardProps = {
  children: ReactNode;
};

export function OwnerOnlyGuard({ children }: OwnerOnlyGuardProps) {
  const router = useRouter();
  const { authenticatedUser } = useMockSession();

  useEffect(() => {
    if (!authenticatedUser || authenticatedUser.systemRole !== "owner") {
      router.replace("/");
    }
  }, [authenticatedUser, router]);

  if (!authenticatedUser || authenticatedUser.systemRole !== "owner") {
    return null;
  }

  return <>{children}</>;
}
