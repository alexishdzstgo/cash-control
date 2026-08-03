export type SystemRole = "owner" | "employee";

export type ShiftParticipantRole = "shift_responsible" | "operator";

export type ShiftParticipantStatus = "active" | "left";

export type ShiftStatus = "active" | "closing" | "closed" | "closed_review_required";

export type ShiftActivityType =
  | "shift_started"
  | "participant_joined"
  | "participant_left"
  | "responsibility_transferred"
  | "operation_registered"
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
};

export type ShiftActivity = {
  id: string;
  type: ShiftActivityType;
  description: string;
  occurredAt: string;
  performedBy: string;
};

export type ShiftClosingResult = "balanced" | "shortage" | "surplus" | null;

export type Shift = {
  id: string;
  name: string;
  status: ShiftStatus;
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