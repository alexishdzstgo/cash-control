"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { useMockSession } from "@/components/session/MockSessionContext";
import { mockRegisteredUsers } from "@/components/workstation/mockData";
import { getStaffMembers, getStaffSummary } from "@/lib/staff";
import { ActiveParticipantsPanel } from "./ActiveParticipantsPanel";
import { StaffList } from "./StaffList";
import { StaffSummary } from "./StaffSummary";

export function StaffPage() {
  const { participants, getContextResponsibleUserId } = useMockSession();
  const members = getStaffMembers(
    mockRegisteredUsers,
    participants,
    getContextResponsibleUserId(),
  );
  const summary = getStaffSummary(members);

  return (
    <div>
      <PageHeader
        title="Personal"
        description="Consulta los usuarios registrados y su participación en el turno actual."
        action={
          <Link
            href="/shifts"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Ver turno
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        }
      />

      <div className="space-y-6">
        <StaffSummary summary={summary} />

        <ActiveParticipantsPanel members={members} />

        <StaffList members={members} />

        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          La administración completa de usuarios se habilitará al conectar la
          base de datos.
        </div>
      </div>
    </div>
  );
}
