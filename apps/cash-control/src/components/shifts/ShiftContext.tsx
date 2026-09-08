"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useRef,
  useState,
} from "react";
import { useMockSession } from "@/components/session/MockSessionContext";
import {
  buildShiftClosing,
  canCloseShift,
  createInitialShift,
  getNextShiftFolio,
  getShiftResponsible,
  validateShiftOpening,
} from "@/lib/shifts";
import type { BankAccountBalance, CashBalance } from "@/types/balance";
import type { CloseShiftInput, Shift } from "@/types/shift";

type ShiftContextValue = {
  currentShift: Shift | null;
  shifts: Shift[];
  getCurrentShift: () => Shift | null;
  getShiftById: (id: string) => Shift | undefined;
  isShiftOpen: () => boolean;
  canCloseCurrentShift: () => boolean;
  canStartShift: () => boolean;
  resetShifts: () => void;
  startShift: (input: { cash: CashBalance; banks: BankAccountBalance[] }) => {
    success: boolean;
    shift?: Shift;
    error?: string;
  };
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
  const latest = useRef({
    currentShift,
    authenticatedUser,
    participants,
    shifts,
  });
  latest.current = { currentShift, authenticatedUser, participants, shifts };

  function canStartShift() {
    const current = latest.current;
    return (
      !current.currentShift &&
      Boolean(
        current.authenticatedUser &&
          current.participants.some(
            (participant) =>
              participant.userId === current.authenticatedUser?.userId &&
              participant.status === "active" &&
              participant.participationType === "responsible",
          ),
      )
    );
  }

  function startShift(input: {
    cash: CashBalance;
    banks: BankAccountBalance[];
  }) {
    if (!canStartShift())
      return {
        success: false,
        error:
          "Solo el responsable actual puede iniciar un turno cuando no hay uno abierto.",
      };
    const responsible = getShiftResponsible(latest.current.participants);
    if (!responsible)
      return { success: false, error: "No hay un responsable activo." };
    const error = validateShiftOpening(input);
    if (error) return { success: false, error };
    const shift = createInitialShift({
      ...input,
      responsible,
      id: `shift-${crypto.randomUUID()}`,
      openedAt: new Date().toISOString(),
      folio: getNextShiftFolio(latest.current.shifts),
    });
    // Publish synchronously to prevent duplicate starts and stale domain callbacks.
    latest.current = {
      ...latest.current,
      currentShift: shift,
      shifts: [...latest.current.shifts, shift],
    };
    setStoredShifts((current) => [...current, shift]);
    return { success: true, shift };
  }

  function resetShifts() {
    latest.current = { ...latest.current, currentShift: null, shifts: [] };
    closedIds.current.clear();
    setStoredShifts([]);
  }

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
    latest.current = {
      ...latest.current,
      currentShift: null,
      shifts: latest.current.shifts.map((shift) =>
        shift.id === activeShift.id ? closedShift : shift,
      ),
    };
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
        getCurrentShift: () => latest.current.currentShift,
        getShiftById: (id) => shifts.find((shift) => shift.id === id),
        isShiftOpen: () => latest.current.currentShift?.status === "open",
        canStartShift,
        startShift,
        resetShifts,
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
