import { CalendarClock, Layers3, ListChecks, ShieldCheck } from "lucide-react";
import type {
  CommissionOperationType,
  CommissionRule,
} from "@/types/commission";

type CommissionSummaryProps = {
  rules: CommissionRule[];
  operationType: CommissionOperationType;
};

export function CommissionSummary({
  rules,
  operationType,
}: CommissionSummaryProps) {
  const scopedRules = rules.filter((rule) => rule.operationType === operationType);
  const activeRules = scopedRules.filter((rule) => rule.status === "active");
  const latestVersion = Math.max(...scopedRules.map((rule) => rule.version), 1);
  const latestChange = scopedRules
    .map((rule) => rule.validFrom)
    .sort()
    .at(-1);

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SummaryCard
        icon={<ListChecks className="h-4 w-4" aria-hidden="true" />}
        label="Rangos activos"
        value={activeRules.length.toString()}
      />
      <SummaryCard
        icon={<Layers3 className="h-4 w-4" aria-hidden="true" />}
        label="Versión más reciente"
        value={`v${latestVersion}`}
      />
      <SummaryCard
        icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
        label="Tipo"
        value={operationType === "deposito" ? "Depósitos" : "Retiros"}
      />
      <SummaryCard
        icon={<CalendarClock className="h-4 w-4" aria-hidden="true" />}
        label="Último cambio"
        value={latestChange ? new Date(latestChange).toLocaleDateString("es-MX") : "Sin cambios"}
      />
    </section>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB]">
          {icon}
        </div>
        <p className="text-sm font-medium">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-950 tabular-nums">
        {value}
      </p>
    </div>
  );
}
