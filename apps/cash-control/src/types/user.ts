import type { SystemRole } from "@/components/workstation/types";

export type UserAccountStatus = "active" | "suspended";

export type UserLastLoginLabel = "today" | "yesterday" | "never";

export type UserAvatar =
  | {
      type: "generated";
      style: "avataaars-neutral" | "shapes";
      seed: string;
    }
  | {
      type: "initials";
    };

export type UserAccount = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  username: string;
  systemRole: SystemRole;
  status: UserAccountStatus;
  avatar?: UserAvatar;
  createdAt: string;
  lastLogin: UserLastLoginLabel;
  temporaryPassword: string;
  internalNotes: string;
  authUserId?: string;
  profileId?: string;
  passwordRecoveryStatus?: "not_configured" | "available";
  sessionsReady?: boolean;
};

export type UserFilter =
  | "all"
  | "owners"
  | "employees"
  | "active"
  | "suspended";

export type UserSummary = {
  total: number;
  owners: number;
  employees: number;
  suspended: number;
};

export type UserActivityEvent = {
  id: string;
  label: string;
  occurredAt: string;
};

export type UserStats = {
  deposits: number | null;
  withdrawals: number | null;
  corrections: number | null;
  responsibleShifts: number | null;
  supportShifts: number | null;
};
