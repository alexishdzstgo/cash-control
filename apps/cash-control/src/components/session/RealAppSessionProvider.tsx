"use client";

import type { ReactNode } from "react";
import {
  type RealWorkstationOperator,
  RealWorkstationSessionProvider,
  type RealWorkstationState,
  useRealWorkstationSession,
} from "@/components/workstation/RealWorkstationSessionProvider";

export type RealAppSessionState = RealWorkstationState;

export type RealAppSessionOperator = Pick<
  RealWorkstationOperator,
  "identity" | "operatorExpiresAt" | "workstationExpiresAt"
>;

export function RealAppSessionProvider({ children }: { children: ReactNode }) {
  return (
    <RealWorkstationSessionProvider>{children}</RealWorkstationSessionProvider>
  );
}

export function useRealAppSession() {
  const { state, operator, refresh, lock, close } = useRealWorkstationSession();

  const safeOperator: RealAppSessionOperator | null = operator
    ? {
        identity: operator.identity,
        operatorExpiresAt: operator.operatorExpiresAt,
        ...(operator.workstationExpiresAt
          ? { workstationExpiresAt: operator.workstationExpiresAt }
          : {}),
      }
    : null;

  return {
    state,
    operator: safeOperator,
    refresh,
    lock,
    close,
  };
}
