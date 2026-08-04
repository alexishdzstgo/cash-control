import { AlertTriangle } from "lucide-react";
import { commissionCoverageNotice } from "./commissionMockData";

export function CommissionCoverageAlert() {
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>{commissionCoverageNotice}</p>
      </div>
    </section>
  );
}
