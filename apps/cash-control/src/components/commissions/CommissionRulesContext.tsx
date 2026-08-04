"use client";

import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { CommissionRule } from "@/types/commission";
import { createInitialCommissionRules } from "./commissionMockData";

type CommissionRulesContextValue = {
  rules: CommissionRule[];
  setRules: Dispatch<SetStateAction<CommissionRule[]>>;
};

const CommissionRulesContext =
  createContext<CommissionRulesContextValue | null>(null);

export function CommissionRulesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [rules, setRules] = useState<CommissionRule[]>(
    createInitialCommissionRules,
  );

  return (
    <CommissionRulesContext.Provider value={{ rules, setRules }}>
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
