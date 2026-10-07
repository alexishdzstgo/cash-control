"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { useRealAppSession } from "@/components/session/RealAppSessionProvider";

type OwnerOnlyGuardProps = {
  children: ReactNode;
};

export function OwnerOnlyGuard({ children }: OwnerOnlyGuardProps) {
  const router = useRouter();
  const { state, operator } = useRealAppSession();
  const isOwner = state === "ACTIVE" && operator?.identity.role === "owner";

  useEffect(() => {
    if (state === "ACTIVE" && operator && operator.identity.role !== "owner") {
      router.replace("/");
    }
  }, [operator, router, state]);

  if (!isOwner) return null;

  return <>{children}</>;
}
