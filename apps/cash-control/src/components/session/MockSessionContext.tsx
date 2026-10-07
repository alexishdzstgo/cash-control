"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { initialUserAccounts } from "@/components/users/userMockData";
import { mockParticipants } from "@/components/workstation/mockData";
import type { Participant, SystemRole, RegisteredUser } from "@/components/workstation/types";
import type { UserAvatar } from "@/types/user";

export interface SessionUser {
  userId: string;
  userName: string;
  systemRole: SystemRole;
  hasActiveParticipation: boolean;
}

interface MockSessionContextValue {
  authenticatedUser: SessionUser | null;
  registeredUsers: RegisteredUser[];
  isSessionLoading: boolean;
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
  // ── Domain capabilities ──
  canAddParticipant: () => boolean;
  canRemoveParticipant: (targetUserId: string) => boolean;
  canTransferResponsibility: () => boolean;
  canEndOwnParticipation: () => boolean;
  isCurrentUserResponsible: () => boolean;
  getContextResponsibleUserId: () => string | null;
  syncParticipants: (participants: Participant[]) => void;
  refreshSessionData: () => Promise<void>;
}

const MockSessionContext = createContext<MockSessionContextValue | null>(null);

function getCurrentTime(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
}

export function MockSessionProvider({ children }: { children: ReactNode }) {
  const [authenticatedUser, setAuthenticatedUser] =
    useState<SessionUser | null>(null);
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [userAvatars, setUserAvatars] = useState<
    Record<string, UserAvatar | undefined>
  >(() =>
    Object.fromEntries(
      initialUserAccounts.map((user) => [user.id, user.avatar]),
    ),
  );

  const [isSessionLoading, setIsSessionLoading] = useState(true);

  const refreshSessionData = useCallback(async () => {
    try {
      const ts = Date.now();
      const [sessionRes, partRes, usersRes] = await Promise.all([
        fetch(`/api/workstation/session?t=${ts}`).catch(() => null),
        fetch(`/api/workstation/participants?t=${ts}`).catch(() => null),
        fetch(`/api/users?t=${ts}`).catch(() => null),
      ]);

      if (usersRes?.ok) {
        const usersData = await usersRes.json().catch(() => null);
        if (usersData?.ok) {
          const mappedUsers: RegisteredUser[] = usersData.users.map((u: any) => ({
            userId: u.id,
            userName: u.displayName,
            systemRole: u.systemRole,
            pin: "",
          }));
          setRegisteredUsers(mappedUsers);
        }
      }

      if (sessionRes?.ok) {
        const sessionData = await sessionRes.json().catch(() => null);
        if (sessionData?.ok) {
          setAuthenticatedUser(sessionData.session);
        }
      }

      if (partRes?.ok) {
        const partData = await partRes.json().catch(() => null);
        if (partData?.ok) {
          const mappedParticipants = partData.participants.map((p: any) => ({
            userId: p.memberId,
            userName: p.displayName,
            participationType:
              p.role === "shift_responsible" ? "responsible" : "support",
            status: p.status,
            startedAt: new Date(p.joinedAt).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }),
            id: p.memberId,
          }));
          setParticipants(mappedParticipants);
        }
      }
    } catch (e) {
      // Fallback
    }
  }, []);

  // Hybrid Auth: Validate real cookie session and real participants
  useEffect(() => {
    let mounted = true;

    async function loadDataAndSetLoading() {
      await refreshSessionData();
      if (mounted) setIsSessionLoading(false);
    }

    void loadDataAndSetLoading();

    return () => {
      mounted = false;
    };
  }, [refreshSessionData]);

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

  const syncParticipants = useCallback((newParticipants: Participant[]) => {
    setParticipants(newParticipants);
  }, []);

  const getUserAvatar = useCallback(
    (userId: string): UserAvatar | undefined => userAvatars[userId],
    [userAvatars],
  );

  const updateUserAvatar = useCallback((userId: string, avatar: UserAvatar) => {
    setUserAvatars((current) => ({ ...current, [userId]: avatar }));
  }, []);

  const startParticipation = useCallback((userId: string): void => {
    // With backend mutations, this local method is mostly for fallback mapping
    // if it were ever called locally. We depend on the global `participants` and `refreshSessionData`.
    setParticipants((prev) => {
      const alreadyActive = prev.some(
        (p) => p.userId === userId && p.status === "active",
      );
      if (alreadyActive) return prev;

      const newParticipant: Participant = {
        id: `part-${Date.now()}`,
        userId,
        userName: "Cargando...",
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

  const addParticipant = useCallback(
    (userId: string): void => {
      // Authorization: only owner can add participants (RN-PAR-010)
      if (!authenticatedUser || authenticatedUser.systemRole !== "owner") {
        console.warn("addParticipant blocked: only owner can add participants");
        return;
      }

      const registeredUser = registeredUsers.find(
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
      const toParticipation = getActiveParticipation(toUserId);
      // toUser will be resolved locally if found, normally API handles real roles.
      if (!toParticipation) {
        return { success: false, error: "Usuario destino no encontrado" };
      }

      // Backend already verified PIN. We skip local verification here to prevent synchronization mismatches.

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
      const fromParticipation = getActiveParticipation(fromUserId);
      const toUser = registeredUsers.find((u) => u.userId === toUserId);
      const fromUser = registeredUsers.find((u) => u.userId === fromUserId);

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

      const fromUserName = fromUser?.userName || fromParticipation?.userName || fromUserId;
      const toUserName = toUser?.userName || toParticipation?.userName || toUserId;
      addActivityEvent(
        `Responsabilidad transferida de ${fromUserName} a ${toUserName}`,
      );
      return { success: true };
    },
    [participants, addActivityEvent, registeredUsers, getActiveParticipation],
  );

  // ── Domain capabilities ──

  const canAddParticipant = useCallback((): boolean => {
    if (!authenticatedUser) return false;
    return authenticatedUser.systemRole === "owner";
  }, [authenticatedUser]);

  const canRemoveParticipant = useCallback(
    (targetUserId: string): boolean => {
      // Allow ending if the targeted user is not the responsible one.
      const targetParticipation = getActiveParticipation(targetUserId);
      if (
        !targetParticipation ||
        targetParticipation.participationType === "responsible"
      ) {
        return false;
      }
      return true;
    },
    [getActiveParticipation],
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
        registeredUsers,
        isSessionLoading,
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
        // ── Domain capabilities ──
        canAddParticipant,
        canRemoveParticipant,
        canTransferResponsibility,
        canEndOwnParticipation,
        isCurrentUserResponsible,
        getContextResponsibleUserId,
        syncParticipants,
        refreshSessionData,
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
