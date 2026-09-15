"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMockSession } from "@/components/session/MockSessionContext";
import { useOptionalRealAppSession } from "@/components/session/RealAppSessionProvider";
import { useOptionalRealWorkstationSession } from "@/components/workstation/RealWorkstationSessionProvider";
import {
  buildShiftClosing,
  canCloseShift,
  createInitialShift,
  getShiftResponsible,
  validateShiftOpening,
} from "@/lib/shifts";
import {
  addPersistedShiftParticipant,
  getShiftSnapshot,
  leavePersistedShift,
  openPersistedShift,
  ShiftApiError,
  type ShiftApiParticipant,
  type ShiftApiShift,
  transferPersistedShiftResponsibility,
} from "@/lib/shifts/client";
import type { BankAccountBalance, CashBalance } from "@/types/balance";
import type { CloseShiftInput, Shift, ShiftParticipant } from "@/types/shift";

type ShiftResult = {
  success: boolean;
  shift?: Shift;
  participant?: ShiftParticipant;
  error?: string;
};

type ShiftContextValue = {
  currentShift: Shift | null;
  shifts: Shift[];
  participants: ShiftParticipant[];
  loading: boolean;
  error: string | null;
  isMutating: boolean;
  isPersisted: boolean;
  getCurrentShift: () => Shift | null;
  getShiftById: (id: string) => Shift | undefined;
  isShiftOpen: () => boolean;
  canCloseCurrentShift: () => boolean;
  canStartShift: () => boolean;
  canAddParticipant: () => boolean;
  canLeaveShift: () => boolean;
  isCurrentUserParticipant: () => boolean;
  isCurrentUserResponsible: () => boolean;
  resetShifts: () => void;
  refresh: () => Promise<boolean>;
  startShift: (input: {
    cash: CashBalance;
    banks: BankAccountBalance[];
  }) => ShiftResult | Promise<ShiftResult>;
  addParticipant: (memberId: string) => Promise<ShiftResult>;
  transferResponsibility: (
    memberId: string,
    receiverPin?: string,
  ) => ShiftResult | Promise<ShiftResult>;
  leaveShift: () => Promise<ShiftResult>;
  closeCurrentShift: (input: CloseShiftInput) => ShiftResult;
};

const ShiftContext = createContext<ShiftContextValue | null>(null);

const emptyOpeningBalances = {
  cashPhysical: 0,
  cashReserved: 0,
  banks: [] as Array<{ bankId: string; bankName: string; balance: number }>,
};

function mapParticipant(participant: ShiftApiParticipant): ShiftParticipant {
  return {
    id: participant.memberId,
    userId: participant.memberId,
    name: participant.displayName,
    systemRole: "employee",
    shiftRole: participant.role,
    joinedAt: participant.joinedAt,
    ...(participant.leftAt ? { leftAt: participant.leftAt } : {}),
    status: participant.status,
  };
}

function mapShift(
  shift: ShiftApiShift,
  participants: ShiftParticipant[],
  openingBalances: Shift["openingBalances"] = emptyOpeningBalances,
): Shift {
  return {
    id: shift.id,
    folio: shift.folio,
    status: shift.status,
    openedAt: shift.openedAt,
    responsibleUserId: shift.responsibleMemberId,
    responsibleUserName:
      participants.find(
        (participant) =>
          participant.userId === shift.responsibleMemberId &&
          participant.status === "active",
      )?.name ?? "Sin asignar",
    openingBalances,
  };
}

function emptyRemoteError(error: unknown) {
  return error instanceof ShiftApiError
    ? error.message
    : "No se pudo completar la operación del turno.";
}

export function ShiftProvider({ children }: { children: ReactNode }) {
  const realSession = useOptionalRealAppSession();
  const realWorkstationSession = useOptionalRealWorkstationSession();
  const {
    participants: mockParticipants,
    authenticatedUser,
    addParticipant: addMockParticipant,
    transferResponsibility: transferMockResponsibility,
    endParticipation: endMockParticipation,
  } = useMockSession();
  const [storedShifts, setStoredShifts] = useState<Shift[]>([]);
  const [snapshot, setSnapshot] = useState<{
    shift: ShiftApiShift | null;
    participants: ShiftApiParticipant[];
  }>({ shift: null, participants: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const openingBalancesByShift = useRef(
    new Map<string, Shift["openingBalances"]>(),
  );
  const closedIds = useRef(new Set<string>());
  const isPersisted = Boolean(realWorkstationSession);

  const remoteParticipants = useMemo(
    () => snapshot.participants.map(mapParticipant),
    [snapshot.participants],
  );
  const remoteShift = useMemo(
    () =>
      snapshot.shift
        ? mapShift(
            snapshot.shift,
            remoteParticipants,
            openingBalancesByShift.current.get(snapshot.shift.id),
          )
        : null,
    [remoteParticipants, snapshot.shift],
  );

  const responsible = getShiftResponsible(mockParticipants);
  const legacyShifts = storedShifts.map((shift) =>
    shift.status === "open"
      ? {
          ...shift,
          responsibleUserId: responsible?.userId ?? "",
          responsibleUserName: responsible?.userName ?? "",
        }
      : shift,
  );
  const legacyCurrentShift =
    legacyShifts.find((shift) => shift.status === "open") ?? null;
  const shifts = isPersisted
    ? remoteShift
      ? [remoteShift]
      : []
    : legacyShifts;
  const currentShift = isPersisted ? remoteShift : legacyCurrentShift;
  const participants = isPersisted
    ? remoteParticipants
    : mockParticipants.map(
        (participant): ShiftParticipant => ({
          id: participant.id,
          userId: participant.userId,
          name: participant.userName,
          systemRole:
            participant.userId === "maria-lopez" ? "owner" : "employee",
          shiftRole:
            participant.participationType === "responsible"
              ? "shift_responsible"
              : "operator",
          joinedAt: new Date().toISOString(),
          status: participant.status === "active" ? "active" : "left",
        }),
      );

  const latest = useRef({
    currentShift,
    authenticatedUser,
    mockParticipants,
    shifts,
  });
  latest.current = {
    currentShift,
    authenticatedUser,
    mockParticipants,
    shifts,
  };

  const refresh = useCallback(async () => {
    if (realSession.state !== "ACTIVE") return false;
    setLoading(true);
    try {
      const next = await getShiftSnapshot();
      setSnapshot(next);
      setError(null);
      return true;
    } catch (caughtError) {
      setError(emptyRemoteError(caughtError));
      if (caughtError instanceof ShiftApiError && caughtError.status === 401)
        setSnapshot({ shift: null, participants: [] });
      return false;
    } finally {
      setLoading(false);
    }
  }, [realSession.state]);

  useEffect(() => {
    if (realSession.state === "ACTIVE") {
      void refresh();
      return;
    }
    setSnapshot((current) =>
      current.shift === null && current.participants.length === 0
        ? current
        : { shift: null, participants: [] },
    );
    setError(null);
    setLoading(false);
  }, [realSession.state, refresh]);

  const canStartShift = useCallback(() => {
    if (isPersisted)
      return realSession.state === "ACTIVE" && currentShift === null;
    const current = latest.current;
    return (
      !current.currentShift &&
      Boolean(
        current.authenticatedUser &&
          current.mockParticipants.some(
            (participant) =>
              participant.userId === current.authenticatedUser?.userId &&
              participant.status === "active" &&
              participant.participationType === "responsible",
          ),
      )
    );
  }, [currentShift, isPersisted, realSession.state]);

  const isCurrentUserParticipant = useCallback(() => {
    if (isPersisted) {
      const memberId = realSession.operator?.identity.memberId;
      return Boolean(
        memberId &&
          participants.some(
            (participant) =>
              participant.userId === memberId &&
              participant.status === "active",
          ),
      );
    }
    return Boolean(
      authenticatedUser &&
        mockParticipants.some(
          (participant) =>
            participant.userId === authenticatedUser.userId &&
            participant.status === "active",
        ),
    );
  }, [
    authenticatedUser,
    isPersisted,
    mockParticipants,
    participants,
    realSession.operator,
  ]);

  const isCurrentUserResponsible = useCallback(() => {
    if (!currentShift) return false;
    if (isPersisted)
      return (
        currentShift.responsibleUserId ===
        realSession.operator?.identity.memberId
      );
    return currentShift.responsibleUserId === authenticatedUser?.userId;
  }, [
    authenticatedUser?.userId,
    currentShift,
    isPersisted,
    realSession.operator,
  ]);

  const canAddParticipant = useCallback(
    () =>
      isPersisted
        ? isCurrentUserParticipant() && isCurrentUserResponsible()
        : Boolean(currentShift && authenticatedUser?.systemRole === "owner"),
    [
      authenticatedUser?.systemRole,
      currentShift,
      isCurrentUserParticipant,
      isCurrentUserResponsible,
      isPersisted,
    ],
  );

  const canLeaveShift = useCallback(
    () => isCurrentUserParticipant() && !isCurrentUserResponsible(),
    [isCurrentUserParticipant, isCurrentUserResponsible],
  );

  async function runRemoteMutation(
    operation: () => Promise<unknown>,
  ): Promise<ShiftResult> {
    setIsMutating(true);
    try {
      await operation();
      await refresh();
      setError(null);
      return { success: true };
    } catch (caughtError) {
      const message = emptyRemoteError(caughtError);
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsMutating(false);
    }
  }

  function startShift(input: {
    cash: CashBalance;
    banks: BankAccountBalance[];
  }): ShiftResult | Promise<ShiftResult> {
    if (!isPersisted) {
      if (!canStartShift())
        return {
          success: false,
          error:
            "Solo el responsable actual puede iniciar un turno cuando no hay uno abierto.",
        };
      const legacyResponsible = getShiftResponsible(
        latest.current.mockParticipants,
      );
      if (!legacyResponsible)
        return { success: false, error: "No hay un responsable activo." };
      const openingError = validateShiftOpening(input);
      if (openingError) return { success: false, error: openingError };
      const shift = createInitialShift({
        ...input,
        responsible: legacyResponsible,
        id: `shift-${crypto.randomUUID()}`,
        openedAt: new Date().toISOString(),
        folio: `TUR-${String(latest.current.shifts.length + 1).padStart(6, "0")}`,
      });
      latest.current = {
        ...latest.current,
        currentShift: shift,
        shifts: [...latest.current.shifts, shift],
      };
      setStoredShifts((current) => [...current, shift]);
      return { success: true, shift };
    }

    if (!canStartShift())
      return Promise.resolve({
        success: false,
        error:
          "Ya existe un turno abierto o la sesión real no está disponible.",
      });

    return (async () => {
      setIsMutating(true);
      try {
        const result = await openPersistedShift();
        const openingBalances = {
          cashPhysical: input.cash.physicalBalance,
          cashReserved: input.cash.reservedOperations.reduce(
            (sum, operation) => sum + operation.amount,
            0,
          ),
          banks: input.banks.map((bank) => ({
            bankId: bank.id,
            bankName: bank.bankName,
            balance: bank.realBalance,
          })),
        };
        openingBalancesByShift.current.set(result.shift.id, openingBalances);
        await refresh();
        setError(null);
        return {
          success: true,
          shift: mapShift(result.shift, [], openingBalances),
        };
      } catch (caughtError) {
        const message =
          caughtError instanceof ShiftApiError
            ? caughtError.message
            : "No se pudo iniciar el turno.";
        setError(message);
        return { success: false, error: message };
      } finally {
        setIsMutating(false);
      }
    })();
  }

  async function addParticipant(memberId: string): Promise<ShiftResult> {
    if (!isPersisted) {
      addMockParticipant(memberId);
      return { success: true };
    }
    if (!canAddParticipant())
      return {
        success: false,
        error: "Solo el responsable activo puede agregar participantes.",
      };
    return runRemoteMutation(() => addPersistedShiftParticipant(memberId));
  }

  function transferResponsibility(
    memberId: string,
    receiverPin = "",
  ): ShiftResult | Promise<ShiftResult> {
    if (!isPersisted) {
      if (!authenticatedUser)
        return { success: false, error: "No hay un operador activo." };
      const result = transferMockResponsibility(
        authenticatedUser.userId,
        memberId,
        receiverPin,
      );
      return result.success ? { success: true } : { ...result };
    }
    if (!isCurrentUserResponsible())
      return {
        success: false,
        error: "Solo el responsable actual puede transferir el turno.",
      };
    if (!/^\d{4,6}$/.test(receiverPin))
      return {
        success: false,
        error: "Ingresa un PIN válido del nuevo responsable.",
      };
    return runRemoteMutation(() =>
      transferPersistedShiftResponsibility(memberId, receiverPin),
    );
  }

  async function leaveShift(): Promise<ShiftResult> {
    if (!isPersisted) {
      if (!authenticatedUser)
        return { success: false, error: "No hay un operador activo." };
      const result = endMockParticipation(authenticatedUser.userId);
      return result.success
        ? { success: true }
        : {
            success: false,
            error: result.isResponsible
              ? "El responsable no puede salir del turno."
              : "No se pudo finalizar la participación.",
          };
    }
    if (!canLeaveShift())
      return {
        success: false,
        error:
          "El responsable no puede salir del turno. Primero transfiere la responsabilidad.",
      };
    return runRemoteMutation(() => leavePersistedShift());
  }

  function resetShifts() {
    if (isPersisted) return;
    latest.current = { ...latest.current, currentShift: null, shifts: [] };
    closedIds.current.clear();
    setStoredShifts([]);
  }

  function canCloseCurrentShift() {
    if (isPersisted) return false;
    const current = latest.current;
    return Boolean(
      current.currentShift &&
        !closedIds.current.has(current.currentShift.id) &&
        canCloseShift(
          current.currentShift,
          current.authenticatedUser?.userId,
          current.mockParticipants,
        ),
    );
  }

  function closeCurrentShift(input: CloseShiftInput): ShiftResult {
    if (isPersisted)
      return {
        success: false,
        error: "El cierre de turno no forma parte de la persistencia 0006.",
      };
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

  const value: ShiftContextValue = {
    currentShift,
    shifts,
    participants,
    loading: isPersisted ? loading || realSession.state === "loading" : false,
    error,
    isMutating,
    isPersisted,
    getCurrentShift: () => latest.current.currentShift,
    getShiftById: (id) => shifts.find((shift) => shift.id === id),
    isShiftOpen: () => latest.current.currentShift?.status === "open",
    canCloseCurrentShift,
    canStartShift,
    canAddParticipant,
    canLeaveShift,
    isCurrentUserParticipant,
    isCurrentUserResponsible,
    resetShifts,
    refresh,
    startShift,
    addParticipant,
    transferResponsibility,
    leaveShift,
    closeCurrentShift,
  };

  return (
    <ShiftContext.Provider value={value}>{children}</ShiftContext.Provider>
  );
}

export function useShift(): ShiftContextValue {
  const context = useContext(ShiftContext);
  if (!context) throw new Error("useShift must be used within ShiftProvider");
  return context;
}
