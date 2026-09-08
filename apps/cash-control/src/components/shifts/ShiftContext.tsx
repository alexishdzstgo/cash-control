"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  buildInitialZeroBanks,
  buildInitialZeroCash,
} from "@/components/balances/balanceMockData";
import { useMockSession } from "@/components/session/MockSessionContext";
import {
  buildShiftClosing,
  canCloseShift,
  createInitialShift,
  getShiftResponsible,
} from "@/lib/shifts";
import type { CloseShiftInput, Shift } from "@/types/shift";

type ShiftContextValue = {
  currentShift: Shift | null;
  shifts: Shift[];
  getCurrentShift: () => Shift | null;
  getShiftById: (id: string) => Shift | undefined;
  isShiftOpen: () => boolean;
  canCloseCurrentShift: () => boolean;
  closeCurrentShift: (input: CloseShiftInput) => {
    success: boolean;
    shift?: Shift;
    error?: string;
  };
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
  const closedIds = useRef(new Set<string>());
  const latest = useRef({ currentShift, authenticatedUser, participants });
  latest.current = { currentShift, authenticatedUser, participants };

  function canCloseCurrentShift() {
    const current = latest.current;
    return Boolean(
      current.currentShift &&
        !closedIds.current.has(current.currentShift.id) &&
        canCloseShift(
          current.currentShift,
          current.authenticatedUser?.userId,
          current.participants,
        ),
    );
  }

  function closeCurrentShift(input: CloseShiftInput) {
    const { currentShift: activeShift, authenticatedUser: actor } =
      latest.current;
    if (
      !canCloseCurrentShift() ||
      !activeShift ||
      !actor ||
      activeShift.id !== input.shiftId
    ) {
      return {
        success: false,
        error:
          "Solo el responsable actual de un turno abierto puede confirmar su corte.",
      };
    }
    if (
      activeShift.openingBalances.banks.some(
        (bank) =>
          !input.banks.some((counted) => counted.bankId === bank.bankId),
      )
    ) {
      return {
        success: false,
        error: "Completa el conteo de todos los bancos del turno.",
      };
    }
    const closedAt = new Date().toISOString();
    const result = buildShiftClosing(input, actor, closedAt);
    if (result.error || !result.closing)
      return { success: false, error: result.error };
    const closedShift: Shift = {
      ...activeShift,
      status: "closed",
      closedAt,
      closing: result.closing,
    };
    // Synchronous lock prevents a second submission before React commits the update.
    closedIds.current.add(activeShift.id);
    setStoredShifts((current) =>
      current.map((shift) =>
        shift.id === activeShift.id ? closedShift : shift,
      ),
    );
    return { success: true, shift: closedShift };
  }

  return (
    <ShiftContext.Provider
      value={{
        currentShift,
        shifts,
        getCurrentShift: () => currentShift,
        getShiftById: (id) => shifts.find((shift) => shift.id === id),
        isShiftOpen: () => currentShift?.status === "open",
        canCloseCurrentShift,
        closeCurrentShift,
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
