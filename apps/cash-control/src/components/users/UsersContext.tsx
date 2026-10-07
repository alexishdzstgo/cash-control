"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { RegisteredUser } from "@/components/workstation/types";
import { wouldRemoveLastActiveOwner } from "@/lib/users";
import type { UserAccount } from "@/types/user";
import { initialUserAccounts } from "./userMockData";

type UserResult =
  | { success: true; user: UserAccount }
  | { success: false; error: string };
type NewUser = Omit<UserAccount, "pin"> & { pin?: string };
type UserUpdates = Partial<Omit<UserAccount, "id">>;

interface UsersContextValue {
  users: UserAccount[];
  registeredUsers: RegisteredUser[];
  getUserById: (id: string) => UserAccount | undefined;
  getActiveUsers: () => UserAccount[];
  createUser: (user: NewUser) => UserResult;
  updateUser: (id: string, updates: UserUpdates) => UserResult;
  suspendUser: (id: string) => UserResult;
  reactivateUser: (id: string) => UserResult;
  validatePin: (id: string, pin: string) => boolean;
}

const UsersContext = createContext<UsersContextValue | null>(null);

export function UsersProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<UserAccount[]>(initialUserAccounts);
  const currentUsers = useRef(users);

  const saveUser = useCallback(
    (user: UserAccount, creating: boolean): UserResult => {
      const current = currentUsers.current;
      if (creating && current.some((entry) => entry.id === user.id)) {
        return { success: false, error: "El usuario ya existe." };
      }
      if (
        current.some(
          (entry) =>
            entry.id !== user.id &&
            entry.username.toLowerCase() === user.username.trim().toLowerCase(),
        )
      ) {
        return {
          success: false,
          error: "Ese nombre de usuario ya está registrado.",
        };
      }
      if (!/^\d{4,6}$/.test(user.pin)) {
        return {
          success: false,
          error: "El PIN debe tener entre 4 y 6 dígitos.",
        };
      }
      if (!creating && wouldRemoveLastActiveOwner(current, user.id, user)) {
        return {
          success: false,
          error: "Debe existir al menos un dueño activo en el sistema.",
        };
      }
      const next = creating
        ? [...current, user]
        : current.map((entry) => (entry.id === user.id ? user : entry));
      currentUsers.current = next;
      setUsers(next);
      return { success: true, user };
    },
    [],
  );

  const createUser = useCallback(
    (user: NewUser): UserResult =>
      saveUser(
        {
          ...user,
          pin: user.pin ?? String(Math.floor(1000 + Math.random() * 9000)),
        },
        true,
      ),
    [saveUser],
  );
  const updateUser = useCallback(
    (id: string, updates: UserUpdates): UserResult => {
      const user = currentUsers.current.find((entry) => entry.id === id);
      if (!user) return { success: false, error: "Usuario no encontrado." };
      const next = { ...user, ...updates };
      if (updates.firstName !== undefined || updates.lastName !== undefined) {
        next.displayName = `${next.firstName.trim()} ${next.lastName.trim()}`;
      }
      return saveUser(next, false);
    },
    [saveUser],
  );

  const getUserById = useCallback(
    (id: string) => currentUsers.current.find((user) => user.id === id),
    [],
  );
  const getActiveUsers = useCallback(
    () => users.filter((user) => user.status === "active"),
    [users],
  );
  const suspendUser = useCallback(
    (id: string) => updateUser(id, { status: "suspended" }),
    [updateUser],
  );
  const reactivateUser = useCallback(
    (id: string) => updateUser(id, { status: "active" }),
    [updateUser],
  );
  const validatePin = useCallback(
    (id: string, pin: string) => {
      const user = getUserById(id);
      return user?.status === "active" && user.pin === pin;
    },
    [getUserById],
  );
  // Compatibility view only; registered accounts are stored once, in users.
  const registeredUsers = useMemo(
    () =>
      users.map((user) => ({
        userId: user.id,
        userName: user.displayName,
        systemRole: user.systemRole,
        pin: user.pin,
      })),
    [users],
  );

  return (
    <UsersContext.Provider
      value={{
        users,
        registeredUsers,
        getUserById,
        getActiveUsers,
        createUser,
        updateUser,
        suspendUser,
        reactivateUser,
        validatePin,
      }}
    >
      {children}
    </UsersContext.Provider>
  );
}

export function useUsers() {
  const context = useContext(UsersContext);
  if (!context) throw new Error("useUsers must be used within UsersProvider");
  return context;
}
