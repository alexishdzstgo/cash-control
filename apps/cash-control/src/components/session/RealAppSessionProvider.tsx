"use client";

import type { ReactNode } from "react";
import {
  type RealWorkstationOperator,
  RealWorkstationSessionProvider,
  type RealWorkstationState,
  useOptionalRealWorkstationSession,
  useRealWorkstationSession,
} from "@/components/workstation/RealWorkstationSessionProvider";

export type RealAppSessionState = RealWorkstationState;

/**
 * Acceso completo a la sesión real de la estación (incluye `startWithPin`) para
 * la pantalla exterior y el panel de estación. Reutiliza el ÚNICO contexto real:
 * no se monta un provider duplicado y los tokens siguen en cookies HttpOnly.
 */
export { useRealWorkstationSession };

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

/**
 * Compatibility hook for isolated legacy tests that render ShiftProvider
 * without the root session provider. The application always mounts the real
 * provider from RootLayout.
 */
export function useOptionalRealAppSession() {
  const context = useOptionalRealWorkstationSession();
  if (!context)
    return {
      state: "NO_OPERATOR" as const,
      operator: null,
      refresh: async () => false,
      lock: async () => false,
      close: async () => false,
    };

  const { state, operator, refresh, lock, close } = context;
  const safeOperator: RealAppSessionOperator | null = operator
    ? {
        identity: operator.identity,
        operatorExpiresAt: operator.operatorExpiresAt,
        ...(operator.workstationExpiresAt
          ? { workstationExpiresAt: operator.workstationExpiresAt }
          : {}),
      }
    : null;
  return { state, operator: safeOperator, refresh, lock, close };
}
