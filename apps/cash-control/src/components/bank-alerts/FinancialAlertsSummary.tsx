import {
  AlertOctagon,
  AlertTriangle,
  BellRing,
  CheckCircle2,
} from "lucide-react";
import type { FinancialAlertsOverview } from "@/lib/financialAlerts";
import { alertToneStyles } from "./alertToneStyles";

type FinancialAlertsSummaryProps = {
  overview: FinancialAlertsOverview;
};

export function FinancialAlertsSummary({
  overview,
}: FinancialAlertsSummaryProps) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SummaryCard
        icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
        label="Recursos normales"
        value={overview.normalResources.toString()}
        tone="normal"
      />
      <SummaryCard
        icon={<AlertTriangle className="h-4 w-4" aria-hidden="true" />}
        label="En atención"
        value={overview.warningResources.toString()}
        tone="warning"
      />
      <SummaryCard
        icon={<AlertOctagon className="h-4 w-4" aria-hidden="true" />}
        label="Críticos"
        value={overview.criticalResources.toString()}
        tone="critical"
      />
      <SummaryCard
        icon={<BellRing className="h-4 w-4" aria-hidden="true" />}
        label="Alertas activas"
        value={overview.activeAlerts.toString()}
        tone={overview.activeAlerts > 0 ? "warning" : "normal"}
      />
    </section>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "normal" | "warning" | "critical";
}) {
  const toneClass = {
    normal: alertToneStyles.success.icon,
    warning: alertToneStyles.warning.icon,
    critical: alertToneStyles.critical.icon,
  }[tone];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneClass}`}
        >
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
