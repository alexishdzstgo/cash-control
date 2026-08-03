export interface RegisteredUser {
  userId: string;
  userName: string;
  pin: string;
  systemRole: SystemRole;
}

export interface Participant {
  id: string;
  userId: string;
  userName: string;
  participationType: "responsible" | "support";
  status: "active" | "ended";
  startedAt: string;
  endedAt?: string;
}

export interface ActivityEvent {
  time: string;
  description: string;
}

export interface WorkstationData {
  id: string;
  name: string;
  status: "open" | "closed";
  openedAt: string;
  trustStatus: string;
  responsibleUserId: string;
  participants: Participant[];
}

export type SystemRole = "owner" | "employee";
