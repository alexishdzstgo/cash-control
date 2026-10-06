import { AlertTriangle } from "lucide-react";
import type { CommissionOperationType } from "@/types/commission";
import type { CommissionCoverageWarning } from "@/lib/commission";

export function CommissionCoverageAlert({
  warnings,
  currentOperationType
}: {
  warnings: { code: string, message: string, operationType: CommissionOperationType }[];
  currentOperationType: CommissionOperationType;
}) {
  const visibleWarnings = warnings.filter(w => w.operationType === currentOperationType);

  if (visibleWarnings.length === 0) return null;

  return (
    <div className="space-y-2">
      {visibleWarnings.map((warning, idx) => (
        <section key={idx} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{warning.message}</p>
          </div>
        </section>
      ))}
    </div>
  );
}
