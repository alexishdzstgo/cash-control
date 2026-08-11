import type {
  Participant,
  RegisteredUser,
} from "@/components/workstation/types";
import type { UserAvatar } from "@/types/user";

export type StaffMemberView = {
  userId: string;
  userName: string;
  systemRole: "owner" | "employee";
  participationStatus: "active" | "inactive";
  participationType?: "responsible" | "support";
  startedAt?: string;
  isResponsible: boolean;
  avatar?: UserAvatar;
};

export type StaffSummary = {
  totalUsers: number;
  activeParticipants: number;
  responsible: StaffMemberView | null;
  inactiveEmployees: number;
};

export function getStaffMembers(
  users: RegisteredUser[],
  participants: Participant[],
  responsibleUserId: string | null,
): StaffMemberView[] {
  const activeParticipantsByUser = new Map(
    participants
      .filter((participant) => participant.status === "active")
      .map((participant) => [participant.userId, participant]),
  );

  return users.map((user) => {
    const activeParticipation = activeParticipantsByUser.get(user.userId);
    const participationType = activeParticipation?.participationType;
    const isResponsible =
      user.userId === responsibleUserId ||
      participationType === "responsible";

    return {
      userId: user.userId,
      userName: user.userName,
      systemRole: user.systemRole,
      participationStatus: activeParticipation ? "active" : "inactive",
      participationType,
      startedAt: activeParticipation?.startedAt,
      isResponsible,
    };
  });
}

export function getStaffSummary(members: StaffMemberView[]): StaffSummary {
  const activeParticipants = members.filter(
    (member) => member.participationStatus === "active",
  );

  return {
    totalUsers: members.length,
    activeParticipants: activeParticipants.length,
    responsible:
      members.find(
        (member) =>
          member.participationStatus === "active" && member.isResponsible,
      ) ?? null,
    inactiveEmployees: members.filter(
      (member) =>
        member.systemRole === "employee" &&
        member.participationStatus === "inactive",
    ).length,
  };
}
