import { Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { StaffMemberView } from "@/lib/staff";

type StaffMemberCardProps = {
  member: StaffMemberView;
};

export function StaffMemberCard({ member }: StaffMemberCardProps) {
  const initials = member.userName
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
            {initials}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-950">
              {member.userName}
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant={member.systemRole === "owner" ? "brand" : "neutral"}>
                {member.systemRole === "owner" ? "Dueño" : "Empleado"}
              </Badge>
              <Badge
                variant={
                  member.participationStatus === "active" ? "success" : "neutral"
                }
              >
                {member.participationStatus === "active"
                  ? "Participando"
                  : "Sin participación"}
              </Badge>
            </div>
          </div>
        </div>

        <span
          className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
            member.participationStatus === "active"
              ? "bg-emerald-500"
              : "bg-slate-300"
          }`}
          aria-hidden="true"
        />
      </div>

      <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase text-slate-400">
          Tipo de participación
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-800">
          {member.participationType === "responsible"
            ? "Responsable"
            : member.participationType === "support"
              ? "Apoyo"
              : "Sin participación"}
        </p>
        {member.startedAt && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            Inicio: {member.startedAt}
          </p>
        )}
      </div>
    </article>
  );
}
