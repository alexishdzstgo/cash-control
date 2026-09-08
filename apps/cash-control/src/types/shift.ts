import type { UserAvatar } from "@/types/user";

export type SystemRole = "owner" | "employee";

export type ShiftParticipantRole = "shift_responsible" | "operator";

export type ShiftParticipantStatus = "active" | "left";

export type ShiftStatus = "open" | "closed";

export type Shift = {
  id: string;
  folio: string;
  status: ShiftStatus;
  openedAt: string;
  closedAt?: string;
  responsibleUserId: string;
  responsibleUserName: string;
  openingBalances: {
    cashPhysical: number;
    cashReserved: number;
    banks: Array<{ bankId: string; bankName: string; balance: number }>;
  };
};

type MockShiftStatus =
  | "active"
  | "closing"
  | "closed"
  | "closed_review_required";

export type ShiftActivityType =
  | "shift_started"
  | "participant_joined"
  | "participant_left"
  | "responsibility_transferred"
  | "operation_registered"
  | "deposit_registered"
  | "withdrawal_registered"
  | "pending_withdrawal_registered"
  | "pending_withdrawal_delivered"
  | "funds_movement"
  | "operation_corrected"
  | "operation_clarified"
  | "closing_started"
  | "shift_closed";

export type ShiftParticipant = {
  id: string;
  userId: string;
  name: string;
  systemRole: SystemRole;
  shiftRole: ShiftParticipantRole;
  joinedAt: string;
  leftAt?: string;
  status: ShiftParticipantStatus;
  avatar?: UserAvatar;
};

export type ShiftActivity = {
  id: string;
  type: ShiftActivityType;
  description: string;
  occurredAt: string;
  performedBy: string;
  reference?: string;
  detail?: string;
};

export type ShiftActivitySummary = {
  deposits: number;
  withdrawals: number;
  pendingWithdrawals: number;
  fundsMovements: number;
  corrections: number;
  clarifications: number;
};

// Derived presentation data, never stored inside a Shift.
export type ShiftViewModel = Shift & {
  participants: ShiftParticipant[];
  activity: ShiftActivity[];
  summary: ShiftActivitySummary;
};

export type ShiftClosingResult = "balanced" | "shortage" | "surplus" | null;

// Legacy fixtures used by screens outside the operational shifts module.
export type MockShift = {
  id: string;
  name: string;
  status: MockShiftStatus;
  responsibleUserId: string;
  startedAt: string;
  endedAt?: string;
  currentDuration?: string;
  openingBalance: number;
  closingDifference?: number;
  closingResult?: ShiftClosingResult;
  participants: ShiftParticipant[];
  activity: ShiftActivity[];
};
