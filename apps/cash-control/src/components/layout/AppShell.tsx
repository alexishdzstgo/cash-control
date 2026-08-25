"use client";

import type { ReactNode } from "react";
import { FinancialAlertsProvider } from "@/components/bank-alerts/FinancialAlertsContext";
import { BusinessFundsProvider } from "@/components/business-funds/BusinessFundsContext";
import { CommissionRulesProvider } from "@/components/commissions/CommissionRulesContext";
import { ReceiptPreferencesProvider } from "@/components/receipts/ReceiptPreferencesContext";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <CommissionRulesProvider>
      <BusinessFundsProvider>
        <FinancialAlertsProvider>
          <ReceiptPreferencesProvider>
            <div className="flex h-screen overflow-hidden app-surface">
              <Sidebar />

              <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <Header />

                <main className="min-h-0 flex-1 overflow-y-auto p-6">
                  {children}
                </main>

                <Footer />
              </div>
            </div>
          </ReceiptPreferencesProvider>
        </FinancialAlertsProvider>
      </BusinessFundsProvider>
    </CommissionRulesProvider>
  );
}
