"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { CommissionRule } from "@/types/commission";

type CommissionRulesContextValue = {
  rules: CommissionRule[];
  setRules: Dispatch<SetStateAction<CommissionRule[]>>;
  isLoading: boolean;
  error: Error | null;
  refreshRules: () => Promise<void>;
};

const CommissionRulesContext =
  createContext<CommissionRulesContextValue | null>(null);

export function CommissionRulesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refreshRules = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const url = `/api/commissions?t=${Date.now()}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Error fetching commissions");
      }
      const data = await response.json();
      setRules(data.rules || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshRules();
  }, [refreshRules]);

  return (
    <CommissionRulesContext.Provider value={{ rules, setRules, isLoading, error, refreshRules }}>
      {children}
    </CommissionRulesContext.Provider>
  );
}

export function useCommissionRules(): CommissionRulesContextValue {
  const context = useContext(CommissionRulesContext);
  if (!context) {
    throw new Error(
      "useCommissionRules must be used within CommissionRulesProvider",
    );
  }

  return context;
}
