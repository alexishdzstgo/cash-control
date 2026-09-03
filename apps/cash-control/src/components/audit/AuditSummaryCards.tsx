import {
  CalendarClock,
  FilePenLine,
  MessageSquareText,
  Users,
} from "lucide-react";
import { type AuditSummary, getCorrectionReason } from "@/lib/audit";
import { formatDateTime } from "@/lib/formatters";

type AuditSummaryCardsProps = {
  summary: AuditSummary;
};

export function AuditSummaryCards({ summary }: AuditSummaryCardsProps) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SummaryCard
        icon={<FilePenLine className="h-4 w-4" aria-hidden="true" />}
        label="Operaciones corregidas"
        value={summary.totalEdited.toString()}
      />

      {summary.latestCorrection && (
        <SummaryCard
          icon={<CalendarClock className="h-4 w-4" aria-hidden="true" />}
          label="Última corrección"
          value={formatDateTime(summary.latestCorrection.createdAt)}
          detail={`Folio ${summary.latestCorrection.operation.bankFolio}`}
        />
      )}

      {summary.correctionUsers.length > 0 && (
        <SummaryCard
          icon={<Users className="h-4 w-4" aria-hidden="true" />}
          label="Personas que corrigieron"
          value={summary.correctionUsers.length.toString()}
          detail={summary.correctionUsers.join(", ")}
        />
      )}

      {summary.correctionReasons.length > 0 && (
        <SummaryCard
          icon={<MessageSquareText className="h-4 w-4" aria-hidden="true" />}
          label="Motivos registrados"
          value={summary.correctionReasons.length.toString()}
          detail={
            summary.latestCorrection
              ? getCorrectionReason(summary.latestCorrection)
              : undefined
          }
        />
      )}
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
      <p className="mt-3 text-2xl font-bold text-slate-950 tabular-nums">
        {value}
      </p>
      {detail && (
        <p className="mt-1 truncate text-xs text-slate-500">{detail}</p>
      )}
    </div>
  );
}
