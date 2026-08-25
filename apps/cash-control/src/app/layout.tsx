import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { FinancialAlertsProvider } from "@/components/bank-alerts/FinancialAlertsContext";
import { BusinessFundsProvider } from "@/components/business-funds/BusinessFundsContext";
import { CommissionRulesProvider } from "@/components/commissions/CommissionRulesContext";
import { ReceiptPreferencesProvider } from "@/components/receipts/ReceiptPreferencesContext";
import { MockSessionProvider } from "@/components/session/MockSessionContext";
import { SettingsProvider } from "@/components/settings/SettingsContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Control de caja",
    template: "%s | Control de caja",
  },
  description:
    "Sistema para el control de depósitos, retiros y operaciones de caja.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-MX"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full">
        <CommissionRulesProvider>
          <BusinessFundsProvider>
            <FinancialAlertsProvider>
              <ReceiptPreferencesProvider>
                <SettingsProvider>
                  <MockSessionProvider>{children}</MockSessionProvider>
                </SettingsProvider>
              </ReceiptPreferencesProvider>
            </FinancialAlertsProvider>
          </BusinessFundsProvider>
        </CommissionRulesProvider>
      </body>
    </html>
  );
}
