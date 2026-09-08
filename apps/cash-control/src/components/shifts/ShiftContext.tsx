"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  buildInitialZeroBanks,
  buildInitialZeroCash,
} from "@/components/balances/balanceMockData";
import { useMockSession } from "@/components/session/MockSessionContext";
import {
  canCloseShift,
  createInitialShift,
  getShiftResponsible,
} from "@/lib/shifts";
import type { Shift } from "@/types/shift";

type ShiftContextValue = {
  currentShift: Shift | null;
  shifts: Shift[];
  getCurrentShift: () => Shift | null;
  getShiftById: (id: string) => Shift | undefined;
  isShiftOpen: () => boolean;
  canCloseCurrentShift: () => boolean;
};

const ShiftContext = createContext<ShiftContextValue | null>(null);

export function ShiftProvider({ children }: { children: ReactNode }) {
  const { participants, authenticatedUser } = useMockSession();
  const [storedShifts, setStoredShifts] = useState<Shift[]>([]);

  useEffect(() => {
    if (storedShifts.length > 0) return;
    const responsible = getShiftResponsible(participants);
    if (!responsible) return;
    // Bootstrap the existing Day 1 scenario once on the client, not at build time.
    // Use the same initial balances as BusinessFundsProvider; capture, don't track.
    const initialShift = createInitialShift({
      id: `shift-${crypto.randomUUID()}`,
      openedAt: new Date().toISOString(),
      responsible,
      cash: buildInitialZeroCash(),
      banks: buildInitialZeroBanks(),
    });
    setStoredShifts((current) =>
      current.length > 0 ? current : [initialShift],
    );
  }, [storedShifts.length, participants]);

  const responsible = getShiftResponsible(participants);
  const shifts = storedShifts.map((shift) =>
    shift.status === "open"
      ? {
          ...shift,
          responsibleUserId: responsible?.userId ?? "",
          responsibleUserName: responsible?.userName ?? "",
        }
      : shift,
  );
  const currentShift = shifts.find((shift) => shift.status === "open") ?? null;

  return (
    <ShiftContext.Provider
      value={{
        currentShift,
        shifts,
        getCurrentShift: () => currentShift,
        getShiftById: (id) => shifts.find((shift) => shift.id === id),
        isShiftOpen: () => currentShift?.status === "open",
        canCloseCurrentShift: () =>
          canCloseShift(currentShift, authenticatedUser?.userId, participants),
      }}
    >
      {children}
    </ShiftContext.Provider>
  );
}

export function useShift(): ShiftContextValue {
  const context = useContext(ShiftContext);
  if (!context) throw new Error("useShift must be used within ShiftProvider");
  return context;
}
