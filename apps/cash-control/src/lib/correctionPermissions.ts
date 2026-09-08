import type { SystemRole } from "@/components/workstation/types";

export type CorrectionActor = {
  actorUserId: string;
  actorUserName: string;
  actorSystemRole: SystemRole | undefined;
  actorHasActiveParticipation: boolean;
};

export function canCorrectRecord(
  record: { createdByUserId?: string },
  actor: CorrectionActor,
): boolean {
  return (
    actor.actorSystemRole === "owner" ||
    (actor.actorSystemRole === "employee" &&
      actor.actorHasActiveParticipation &&
      Boolean(actor.actorUserId) &&
      record.createdByUserId === actor.actorUserId)
  );
}
