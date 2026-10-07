"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useRef,
  useCallback,
  useEffect,
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
  refreshShifts: () => Promise<void>;
  startShift: (input: { cash: CashBalance; banks: BankAccountBalance[] }) => Promise<{
    success: boolean;
    shift?: Shift;
    error?: string;
  }>;
  closeCurrentShift: (input: CloseShiftInput) => Promise<{
    success: boolean;
    shift?: Shift;
    error?: string;
  }>;
};

const ShiftContext = createContext<ShiftContextValue | null>(null);

export function ShiftProvider({ children }: { children: ReactNode }) {
  const { participants, authenticatedUser } = useMockSession();
  const [storedShifts, setStoredShifts] = useState<Shift[]>([]);

  const refreshShifts = useCallback(async () => {
    try {
      const res = await fetch(`/api/shifts?t=${Date.now()}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.ok) setStoredShifts(data.shifts);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    refreshShifts();
  }, [refreshShifts]);

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

  async function startShift(input: {
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

    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folio: getNextShiftFolio(latest.current.shifts),
          openedAt: new Date().toISOString(),
          responsibleUserId: responsible.userId,
          responsibleUserName: responsible.userName,
          responsibleUserRole: latest.current.authenticatedUser?.userId === responsible.userId ? latest.current.authenticatedUser?.systemRole : "employee",
          openingBalances: {
            cashPhysical: input.cash.physicalBalance,
            cashReserved: input.cash.reservedOperations.reduce((sum, res) => sum + res.amount, 0),
            banks: input.banks.map(b => ({
              bankId: b.id,
              bankName: b.bankName,
              balance: b.realBalance
            }))
          }
        })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      await refreshShifts();
      return { success: true, shift: data.shift };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Error iniciando turno" };
    }
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

  async function closeCurrentShift(input: CloseShiftInput) {
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

    try {
      const res = await fetch(`/api/shifts/${activeShift.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closing: result.closing })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      // Cierre local preventivo
      closedIds.current.add(activeShift.id);
      await refreshShifts();
      return { success: true, shift: data.shift };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Error cerrando el turno" };
    }
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
        refreshShifts,
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
