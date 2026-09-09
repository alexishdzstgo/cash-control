"use client";

import { ModalShell } from "@/components/shared/ModalShell";
import type { ShiftActivity } from "@/types/shift";
import { ShiftActivityList } from "./ShiftActivityList";

export function ShiftActivityModal({
  folio,
  activities,
  onClose,
}: {
  folio: string;
  activities: ShiftActivity[];
  onClose: () => void;
}) {
  return (
    <ModalShell
      title="Actividad del turno"
      description={`${folio} · Actividad registrada durante este turno.`}
      onClose={onClose}
      maxWidth="lg"
      bodyClassName="max-h-[70vh] overflow-y-auto"
    >
      <ShiftActivityList activities={activities} />
    </ModalShell>
  );
}
