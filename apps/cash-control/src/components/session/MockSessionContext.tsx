"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";
import { initialUserAccounts } from "@/components/users/userMockData";
import {
  mockParticipants,
  mockRegisteredUsers,
} from "@/components/workstation/mockData";
import type { Participant, SystemRole } from "@/components/workstation/types";
import type { UserAvatar } from "@/types/user";

export interface SessionUser {
  userId: string;
  userName: string;
  systemRole: SystemRole;
  hasActiveParticipation: boolean;
}

export interface TransferSummary {
  cashOnHand: number;
  bankBalances: Array<{ bank: string; account: string; balance: number }>;
  pendingWithdrawals: { count: number; total: number };
  pendingDeposits: { count: number; total: number };
  editedOperations: number;
  operationsSinceLastTransfer: number;
  transferTime: string;
}

interface MockSessionContextValue {
  authenticatedUser: SessionUser | null;
  participants: Participant[];
  getUserAvatar: (userId: string) => UserAvatar | undefined;
  updateUserAvatar: (userId: string, avatar: UserAvatar) => void;
  unlockSession: (user: SessionUser) => void;
  lockSession: () => void;
  updateAuthenticatedUser: (updates: Partial<SessionUser>) => void;
  startParticipation: (userId: string) => void;
  endParticipation: (userId: string) => {
    success: boolean;
    isResponsible: boolean;
    isOnlyParticipant?: boolean;
  };
  getActiveParticipation: (userId: string) => Participant | undefined;
  hasActiveParticipation: (userId: string) => boolean;
  transferResponsibility: (
    fromUserId: string,
    toUserId: string,
    pin: string,
  ) => { success: boolean; error?: string };
  getActiveParticipants: () => Participant[];
  addParticipant: (userId: string) => void;
  removeParticipant: (userId: string) => {
    success: boolean;
    isResponsible: boolean;
    error?: string;
  };
  addActivityEvent: (description: string) => void;
  getTransferSummary: () => {
    cashOnHand: number;
    bankBalances: Array<{ bank: string; account: string; balance: number }>;
    pendingWithdrawals: { count: number; total: number };
    pendingDeposits: { count: number; total: number };
    editedOperations: number;
    operationsSinceLastTransfer: number;
    transferTime: string;
  };
  // ── Domain capabilities ──
  canAddParticipant: () => boolean;
  canRemoveParticipant: (targetUserId: string) => boolean;
  canTransferResponsibility: () => boolean;
  canEndOwnParticipation: () => boolean;
  isCurrentUserResponsible: () => boolean;
  getContextResponsibleUserId: () => string | null;
}

const MockSessionContext = createContext<MockSessionContextValue | null>(null);

function getCurrentTime(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
}

export function MockSessionProvider({ children }: { children: ReactNode }) {
  const [authenticatedUser, setAuthenticatedUser] =
    useState<SessionUser | null>(null);
  const [participants, setParticipants] =
    useState<Participant[]>(mockParticipants);
  const [userAvatars, setUserAvatars] = useState<
    Record<string, UserAvatar | undefined>
  >(() =>
    Object.fromEntries(
      initialUserAccounts.map((user) => [user.id, user.avatar]),
    ),
  );

  const unlockSession = useCallback((user: SessionUser) => {
    setAuthenticatedUser(user);
  }, []);

  const lockSession = useCallback(() => {
    setAuthenticatedUser(null);
    // Participants are preserved — lockSession does NOT remove participations
  }, []);

  const updateAuthenticatedUser = useCallback(
    (updates: Partial<SessionUser>) => {
      setAuthenticatedUser((prev) => {
        if (!prev) return null;
        return { ...prev, ...updates };
      });
    },
    [],
  );

  const getUserAvatar = useCallback(
    (userId: string): UserAvatar | undefined => userAvatars[userId],
    [userAvatars],
  );

  const updateUserAvatar = useCallback((userId: string, avatar: UserAvatar) => {
    setUserAvatars((current) => ({ ...current, [userId]: avatar }));
  }, []);

  const startParticipation = useCallback((userId: string): void => {
    const registeredUser = mockRegisteredUsers.find((u) => u.userId === userId);
    if (!registeredUser) return;

    // Functional updater guarantees the latest state for duplicate detection.
    // No external variables are mutated — the updater is pure.
    setParticipants((prev) => {
      const alreadyActive = prev.some(
        (p) => p.userId === userId && p.status === "active",
      );
      if (alreadyActive) return prev;

      const newParticipant: Participant = {
        id: `part-${Date.now()}`,
        userId,
        userName: registeredUser.userName,
        participationType: "support",
        status: "active",
        startedAt: getCurrentTime(),
      };

      return [...prev, newParticipant];
    });
  }, []);

  const endParticipation = useCallback(
    (
      userId: string,
    ): {
      success: boolean;
      isResponsible: boolean;
      isOnlyParticipant?: boolean;
    } => {
      const participation = participants.find(
        (p) => p.userId === userId && p.status === "active",
      );

      if (!participation) {
        return { success: false, isResponsible: false };
      }

      // Check if user is responsible
      if (participation.participationType === "responsible") {
        const activeParticipants = participants.filter(
          (p) => p.status === "active",
        );
        const isOnlyParticipant = activeParticipants.length === 1;
        return { success: false, isResponsible: true, isOnlyParticipant };
      }

      // For support type, end the participation
      const endedAt = getCurrentTime();
      setParticipants((prev) =>
        prev.map((p) =>
          p.userId === userId && p.status === "active"
            ? { ...p, status: "ended" as const, endedAt }
            : p,
        ),
      );

      // Update authenticated user's hasActiveParticipation flag
      setAuthenticatedUser((prev) => {
        if (!prev || prev.userId !== userId) return prev;
        return { ...prev, hasActiveParticipation: false };
      });

      return { success: true, isResponsible: false };
    },
    [participants],
  );

  const getActiveParticipation = useCallback(
    (userId: string): Participant | undefined => {
      return participants.find(
        (p) => p.userId === userId && p.status === "active",
      );
    },
    [participants],
  );

  const hasActiveParticipation = useCallback(
    (userId: string): boolean => {
      return participants.some(
        (p) => p.userId === userId && p.status === "active",
      );
    },
    [participants],
  );

  const getActiveParticipants = useCallback((): Participant[] => {
    return participants.filter((p) => p.status === "active");
  }, [participants]);

  const addActivityEvent = useCallback((description: string) => {
    // Activity events are tracked in a real implementation
    console.log(`Activity: ${description}`);
  }, []);

  const getTransferSummary = useCallback(() => {
    return {
      cashOnHand: 0,
      bankBalances: [],
      pendingWithdrawals: {
        count: 0,
        total: 0,
      },
      pendingDeposits: {
        count: 0,
        total: 0,
      },
      editedOperations: 0,
      operationsSinceLastTransfer: 0,
      transferTime: getCurrentTime(),
    };
  }, []);

  const addParticipant = useCallback(
    (userId: string): void => {
      // Authorization: only owner can add participants (RN-PAR-010)
      if (!authenticatedUser || authenticatedUser.systemRole !== "owner") {
        console.warn("addParticipant blocked: only owner can add participants");
        return;
      }

      const registeredUser = mockRegisteredUsers.find(
        (u) => u.userId === userId,
      );
      if (!registeredUser) return;

      // Functional updater guarantees the latest state for duplicate detection.
      // No external variables are mutated — the updater is pure.
      setParticipants((prev) => {
        const alreadyActive = prev.some(
          (p) => p.userId === userId && p.status === "active",
        );
        if (alreadyActive) return prev;

        const newParticipant: Participant = {
          id: `part-${Date.now()}`,
          userId,
          userName: registeredUser.userName,
          participationType: "support",
          status: "active",
          startedAt: getCurrentTime(),
        };

        return [...prev, newParticipant];
      });

      addActivityEvent(
        `${registeredUser.userName} se incorporó como participante`,
      );
    },
    [authenticatedUser, addActivityEvent],
  );

  const removeParticipant = useCallback(
    (
      userId: string,
    ): { success: boolean; isResponsible: boolean; error?: string } => {
      // Authorization: only owner can remove participants (RN-PAR-011)
      if (!authenticatedUser || authenticatedUser.systemRole !== "owner") {
        return {
          success: false,
          isResponsible: false,
          error: "Solo el propietario puede retirar participantes",
        };
      }

      const participation = participants.find(
        (p) => p.userId === userId && p.status === "active",
      );

      if (!participation) {
        return {
          success: false,
          isResponsible: false,
          error: "Participación activa no encontrada",
        };
      }

      // Prevent removing a responsible participant
      if (participation.participationType === "responsible") {
        return {
          success: false,
          isResponsible: true,
          error:
            "No se puede retirar al responsable del turno. Primero transfiera la responsabilidad.",
        };
      }

      // For support type, end the participation
      const endedAt = getCurrentTime();
      setParticipants((prev) =>
        prev.map((p) =>
          p.userId === userId && p.status === "active"
            ? { ...p, status: "ended" as const, endedAt }
            : p,
        ),
      );

      // Update authenticated user's hasActiveParticipation flag if it's the same user
      setAuthenticatedUser((prev) => {
        if (!prev || prev.userId !== userId) return prev;
        return { ...prev, hasActiveParticipation: false };
      });

      addActivityEvent(`${participation.userName} salió del turno`);
      return { success: true, isResponsible: false };
    },
    [authenticatedUser, participants, addActivityEvent],
  );

  const transferResponsibility = useCallback(
    (
      fromUserId: string,
      toUserId: string,
      pin: string,
    ): { success: boolean; error?: string } => {
      // Verify target user is registered
      const toUser = mockRegisteredUsers.find((u) => u.userId === toUserId);
      if (!toUser) {
        return { success: false, error: "Usuario destino no encontrado" };
      }

      // Verify PIN belongs to the RECEIVER (toUserId), not the sender
      if (toUser.pin !== pin) {
        return { success: false, error: "PIN incorrecto" };
      }

      // Verify target user has active participation
      const targetParticipation = participants.find(
        (p) => p.userId === toUserId && p.status === "active",
      );
      if (!targetParticipation) {
        return {
          success: false,
          error: "El usuario destino no tiene participación activa",
        };
      }

      // Get sender info for audit
      const fromUser = mockRegisteredUsers.find((u) => u.userId === fromUserId);

      // Transfer responsibility
      setParticipants((prev) =>
        prev.map((p) => {
          if (p.userId === fromUserId && p.status === "active") {
            return { ...p, participationType: "support" as const };
          }
          if (p.userId === toUserId && p.status === "active") {
            return { ...p, participationType: "responsible" as const };
          }
          return p;
        }),
      );

      const fromUserName = fromUser?.userName || fromUserId;
      const toUserName = toUser.userName;
      addActivityEvent(
        `Responsabilidad transferida de ${fromUserName} a ${toUserName}`,
      );
      return { success: true };
    },
    [participants, addActivityEvent],
  );

  // ── Domain capabilities ──

  const canAddParticipant = useCallback((): boolean => {
    if (!authenticatedUser) return false;
    return authenticatedUser.systemRole === "owner";
  }, [authenticatedUser]);

  const canRemoveParticipant = useCallback(
    (targetUserId: string): boolean => {
      if (!authenticatedUser) return false;
      if (authenticatedUser.systemRole !== "owner") return false;

      // Cannot remove the responsible participant
      const targetParticipation = participants.find(
        (p) => p.userId === targetUserId && p.status === "active",
      );
      if (targetParticipation?.participationType === "responsible")
        return false;

      return true;
    },
    [authenticatedUser, participants],
  );

  const canTransferResponsibility = useCallback((): boolean => {
    if (!authenticatedUser) return false;
    const activeParticipation = participants.find(
      (p) => p.userId === authenticatedUser.userId && p.status === "active",
    );
    return activeParticipation?.participationType === "responsible";
  }, [authenticatedUser, participants]);

  const canEndOwnParticipation = useCallback((): boolean => {
    if (!authenticatedUser) return false;
    const activeParticipation = participants.find(
      (p) => p.userId === authenticatedUser.userId && p.status === "active",
    );
    // Can end own participation only if NOT responsible
    return activeParticipation?.participationType !== "responsible";
  }, [authenticatedUser, participants]);

  const isCurrentUserResponsible = useCallback((): boolean => {
    if (!authenticatedUser) return false;
    const activeParticipation = participants.find(
      (p) => p.userId === authenticatedUser.userId && p.status === "active",
    );
    return activeParticipation?.participationType === "responsible";
  }, [authenticatedUser, participants]);

  const getContextResponsibleUserId = useCallback((): string | null => {
    const responsible = participants.find(
      (p) => p.participationType === "responsible" && p.status === "active",
    );
    return responsible?.userId ?? null;
  }, [participants]);

  return (
    <MockSessionContext.Provider
      value={{
        authenticatedUser,
        participants,
        getUserAvatar,
        updateUserAvatar,
        unlockSession,
        lockSession,
        updateAuthenticatedUser,
        startParticipation,
        endParticipation,
        getActiveParticipation,
        hasActiveParticipation,
        transferResponsibility,
        getActiveParticipants,
        addParticipant,
        removeParticipant,
        addActivityEvent,
        getTransferSummary,
        // ── Domain capabilities ──
        canAddParticipant,
        canRemoveParticipant,
        canTransferResponsibility,
        canEndOwnParticipation,
        isCurrentUserResponsible,
        getContextResponsibleUserId,
      }}
    >
      {children}
    </MockSessionContext.Provider>
  );
}

export function useMockSession(): MockSessionContextValue {
  const ctx = useContext(MockSessionContext);
  if (!ctx) {
    throw new Error("useMockSession must be used within a MockSessionProvider");
  }
  return ctx;
}
