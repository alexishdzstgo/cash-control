"use client";

import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type {
  ReceiptBusinessIdentity,
  ReceiptPreferences,
} from "@/types/receipt";
import {
  initialBusinessIdentity,
  initialReceiptPreferences,
} from "./receiptMockData";

type ReceiptPreferencesContextValue = {
  businessIdentity: ReceiptBusinessIdentity;
  setBusinessIdentity: Dispatch<SetStateAction<ReceiptBusinessIdentity>>;
  preferences: ReceiptPreferences;
  setPreferences: Dispatch<SetStateAction<ReceiptPreferences>>;
};

const ReceiptPreferencesContext =
  createContext<ReceiptPreferencesContextValue | null>(null);

export function ReceiptPreferencesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [businessIdentity, setBusinessIdentity] =
    useState<ReceiptBusinessIdentity>(initialBusinessIdentity);
  const [preferences, setPreferences] = useState<ReceiptPreferences>(
    initialReceiptPreferences,
  );

  return (
    <ReceiptPreferencesContext.Provider
      value={{
        businessIdentity,
        setBusinessIdentity,
        preferences,
        setPreferences,
      }}
    >
      {children}
    </ReceiptPreferencesContext.Provider>
  );
}

export function useReceiptPreferences(): ReceiptPreferencesContextValue {
  const context = useContext(ReceiptPreferencesContext);
  if (!context) {
    throw new Error(
      "useReceiptPreferences must be used within ReceiptPreferencesProvider",
    );
  }
  return context;
}
