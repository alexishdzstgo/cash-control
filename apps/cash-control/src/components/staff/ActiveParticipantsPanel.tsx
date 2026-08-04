import Link from "next/link";
import { ArrowRight, UserRoundCheck } from "lucide-react";
import type { StaffMemberView } from "@/lib/staff";

type ActiveParticipantsPanelProps = {
  members: StaffMemberView[];
};

export function ActiveParticipantsPanel({ members }: ActiveParticipantsPanelProps) {
  const activeMembers = members.filter(
    (member) => member.participationStatus === "active",
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            Participantes activos
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Personas trabajando en el turno actual.
          </p>
        </div>
        <Link
          href="/shifts"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2563EB] transition-colors hover:text-[#1D4ED8]"
        >
          Administrar participantes
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      {activeMembers.length === 0 ? (
        <div className="px-6 py-8 text-sm text-slate-500">
          No hay participantes activos en el turno actual.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {activeMembers.map((member) => (
            <div
              key={member.userId}
              className="flex items-center justify-between gap-4 px-6 py-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <UserRoundCheck className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {member.userName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {member.participationType === "responsible"
                      ? "Responsable"
                      : "Apoyo"}
                  </p>
                </div>
              </div>
              {member.startedAt && (
                <p className="text-xs font-medium text-slate-500">
                  {member.startedAt}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
