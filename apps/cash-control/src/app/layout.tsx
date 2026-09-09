import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { FinancialAlertsProvider } from "@/components/bank-alerts/FinancialAlertsContext";
import { BusinessFundsProvider } from "@/components/business-funds/BusinessFundsContext";
import { CommissionRulesProvider } from "@/components/commissions/CommissionRulesContext";
import { ReceiptPreferencesProvider } from "@/components/receipts/ReceiptPreferencesContext";
import { MockSessionProvider } from "@/components/session/MockSessionContext";
import { SettingsProvider } from "@/components/settings/SettingsContext";
import { NotificationProvider } from "@/components/shared/NotificationProvider";
import { ShiftProvider } from "@/components/shifts/ShiftContext";
import { UsersProvider } from "@/components/users/UsersContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  robots: { index: false, follow: false },
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
          <UsersProvider>
            <MockSessionProvider>
              <ShiftProvider>
                <BusinessFundsProvider>
                  <FinancialAlertsProvider>
                    <ReceiptPreferencesProvider>
                      <SettingsProvider>
                        <NotificationProvider>{children}</NotificationProvider>
                      </SettingsProvider>
                    </ReceiptPreferencesProvider>
                  </FinancialAlertsProvider>
                </BusinessFundsProvider>
              </ShiftProvider>
            </MockSessionProvider>
          </UsersProvider>
        </CommissionRulesProvider>
      </body>
    </html>
  );
}
