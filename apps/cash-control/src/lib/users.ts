import type { Participant } from "@/components/workstation/types";
import type { Operation } from "@/types/operation";
import type {
  UserAccount,
  UserActivityEvent,
  UserFilter,
  UserStats,
  UserSummary,
} from "@/types/user";

export function getUserSummary(users: UserAccount[]): UserSummary {
  return {
    total: users.length,
    owners: users.filter((user) => user.systemRole === "owner").length,
    employees: users.filter((user) => user.systemRole === "employee").length,
    suspended: users.filter((user) => user.status === "suspended").length,
  };
}

export function filterUsers(
  users: UserAccount[],
  search: string,
  filter: UserFilter,
): UserAccount[] {
  const normalizedSearch = search.trim().toLowerCase();

  return users.filter((user) => {
    const matchesSearch =
      normalizedSearch === "" ||
      user.displayName.toLowerCase().includes(normalizedSearch) ||
      user.username.toLowerCase().includes(normalizedSearch);

    const matchesFilter =
      filter === "all" ||
      (filter === "owners" && user.systemRole === "owner") ||
      (filter === "employees" && user.systemRole === "employee") ||
      (filter === "active" && user.status === "active") ||
      (filter === "suspended" && user.status === "suspended");

    return matchesSearch && matchesFilter;
  });
}

export function getActiveOwnerCount(users: UserAccount[]): number {
  return users.filter(
    (user) => user.systemRole === "owner" && user.status === "active",
  ).length;
}

export function wouldRemoveLastActiveOwner(
  users: UserAccount[],
  targetUserId: string,
  nextUser?: Partial<UserAccount>,
): boolean {
  const nextUsers = users.map((user) =>
    user.id === targetUserId ? { ...user, ...nextUser } : user,
  );

  return getActiveOwnerCount(nextUsers) === 0;
}

export function getUserInitials(user: UserAccount): string {
  return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
}

export function getLastLoginLabel(lastLogin: UserAccount["lastLogin"]): string {
  if (lastLogin === "today") return "Hoy";
  if (lastLogin === "yesterday") return "Ayer";
  return "Nunca";
}

export function getUserRoleLabel(role: UserAccount["systemRole"]): string {
  return role === "owner" ? "Dueño" : "Empleado";
}

export function getUserStatusLabel(status: UserAccount["status"]): string {
  return status === "active" ? "Activo" : "Suspendido";
}

export function getUserParticipation(
  user: UserAccount,
  participants: Participant[],
): Participant | undefined {
  return participants.find(
    (participant) =>
      participant.userId === user.id && participant.status === "active",
  );
}

export function getUserActivityEvents(
  user: UserAccount,
  operations: Operation[],
): UserActivityEvent[] {
  const events: UserActivityEvent[] = [];

  if (user.lastLogin !== "never") {
    events.push({
      id: `${user.id}-login`,
      label: "Entró al sistema",
      occurredAt: getLastLoginLabel(user.lastLogin),
    });
  }

  for (const operation of operations) {
    if (matchesUser(operation.createdBy, user)) {
      events.push({
        id: `${operation.id}-created`,
        label:
          operation.type === "deposito"
            ? "Registró depósito"
            : "Registró retiro",
        occurredAt: operation.createdAt,
      });
    }

    if (operation.isEdited && matchesUser(operation.editedBy, user)) {
      events.push({
        id: `${operation.id}-edited`,
        label: "Editó operación",
        occurredAt: operation.editedAt ?? operation.createdAt,
      });
    }
  }

  return events.slice(0, 5);
}

export function getUserStats(
  user: UserAccount,
  operations: Operation[],
  participants: Participant[],
): UserStats {
  const userOperations = operations.filter((operation) =>
    matchesUser(operation.createdBy, user),
  );
  const userCorrections = operations.filter(
    (operation) => operation.isEdited && matchesUser(operation.editedBy, user),
  );
  const roleParticipants = participants.filter(
    (participant) => participant.userId === user.id,
  );

  const hasOperationData =
    userOperations.length > 0 || userCorrections.length > 0;
  const hasShiftData = roleParticipants.length > 0;

  return {
    deposits: hasOperationData
      ? userOperations.filter((operation) => operation.type === "deposito")
          .length
      : null,
    withdrawals: hasOperationData
      ? userOperations.filter((operation) => operation.type === "retiro").length
      : null,
    corrections: hasOperationData ? userCorrections.length : null,
    responsibleShifts: hasShiftData
      ? roleParticipants.filter(
          (participant) => participant.participationType === "responsible",
        ).length
      : null,
    supportShifts: hasShiftData
      ? roleParticipants.filter(
          (participant) => participant.participationType === "support",
        ).length
      : null,
  };
}

export function generateTemporaryPassword(): string {
  const randomPart = Math.floor(100000 + Math.random() * 900000);
  return `Temp-${randomPart}`;
}

function matchesUser(value: string | undefined, user: UserAccount): boolean {
  if (!value) return false;
  const normalizedValue = value.trim().toLowerCase();
  return (
    normalizedValue === user.displayName.toLowerCase() ||
    normalizedValue === user.username.toLowerCase() ||
    normalizedValue === user.id.toLowerCase()
  );
}
