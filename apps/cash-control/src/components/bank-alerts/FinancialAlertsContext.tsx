"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import { useBusinessFunds } from "@/components/business-funds/BusinessFundsContext";
import { computeFinancialTotalsFromBalances } from "@/lib/finance";
import {
  buildDefaultFinancialAlertConfig,
  type FinancialAlertConfig,
  getFinancialAlertsOverview,
  type FinancialAlertsOverview,
} from "@/lib/financialAlerts";

type FinancialAlertsContextValue = {
  config: FinancialAlertConfig;
  overview: FinancialAlertsOverview;
  setConfig: (config: FinancialAlertConfig) => void;
};

const FinancialAlertsContext =
  createContext<FinancialAlertsContextValue | null>(null);

export function FinancialAlertsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { cash, banks } = useBusinessFunds();
  const [config, setConfig] = useState<FinancialAlertConfig>(() =>
    buildDefaultFinancialAlertConfig({ cash, banks }),
  );

  const totals = useMemo(
    () => computeFinancialTotalsFromBalances({ cash, banks }),
    [cash, banks],
  );

  const overview = useMemo(
    () =>
      getFinancialAlertsOverview({
        cash,
        banks,
        totals,
        movementAlerts: [],
        config,
      }),
    [cash, banks, totals, config],
  );

  return (
    <FinancialAlertsContext.Provider value={{ config, overview, setConfig }}>
      {children}
    </FinancialAlertsContext.Provider>
  );
}

export function useFinancialAlerts(): FinancialAlertsContextValue {
  const context = useContext(FinancialAlertsContext);
  if (!context) {
    throw new Error(
      "useFinancialAlerts must be used within FinancialAlertsProvider",
    );
  }
  return context;
}
