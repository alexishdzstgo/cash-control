import { Clock3, ShieldCheck, UserRoundCheck, Users } from "lucide-react";
import type { StaffSummary as StaffSummaryData } from "@/lib/staff";

type StaffSummaryProps = {
  summary: StaffSummaryData;
};

export function StaffSummary({ summary }: StaffSummaryProps) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SummaryCard
        icon={<Users className="h-4 w-4" aria-hidden="true" />}
        label="Usuarios registrados"
        value={summary.totalUsers.toString()}
      />
      <SummaryCard
        icon={<UserRoundCheck className="h-4 w-4" aria-hidden="true" />}
        label="Participantes activos"
        value={summary.activeParticipants.toString()}
      />
      {summary.responsible && (
        <SummaryCard
          icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
          label="Responsable actual"
          value={summary.responsible.userName}
          detail={
            summary.responsible.startedAt
              ? `Desde ${summary.responsible.startedAt}`
              : undefined
          }
        />
      )}
      <SummaryCard
        icon={<Clock3 className="h-4 w-4" aria-hidden="true" />}
        label="Empleados sin participación"
        value={summary.inactiveEmployees.toString()}
      />
    </section>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB]">
          {icon}
        </div>
        <p className="text-sm font-medium">{label}</p>
      </div>
      <p className="mt-3 truncate text-2xl font-bold text-slate-950 tabular-nums">
        {value}
      </p>
      {detail && <p className="mt-1 truncate text-xs text-slate-500">{detail}</p>}
    </div>
  );
}
