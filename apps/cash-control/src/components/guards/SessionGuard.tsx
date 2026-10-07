"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";
import { useRealAppSession } from "@/components/session/RealAppSessionProvider";

export function SessionGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { state } = useRealAppSession();
  const redirecting = useRef(false);

  useEffect(() => {
    if (state === "ACTIVE") {
      redirecting.current = false;
      return;
    }

    if (state !== "loading" && !redirecting.current) {
      redirecting.current = true;
      router.replace("/workstation");
    }
  }, [router, state]);

  if (state !== "ACTIVE") return null;

  return <>{children}</>;
}
