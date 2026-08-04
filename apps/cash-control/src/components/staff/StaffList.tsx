import type { StaffMemberView } from "@/lib/staff";
import { StaffMemberCard } from "./StaffMemberCard";

type StaffListProps = {
  members: StaffMemberView[];
};

export function StaffList({ members }: StaffListProps) {
  if (members.length === 0) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">
          Aún no hay usuarios registrados.
        </h2>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Lista de personal
        </h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Usuarios registrados y estado de participación en el turno actual.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {members.map((member) => (
          <StaffMemberCard key={member.userId} member={member} />
        ))}
      </div>
    </section>
  );
}
