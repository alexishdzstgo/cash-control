import type { CommissionOperationType } from "@/types/commission";

type CommissionTabsProps = {
  value: CommissionOperationType;
  onChange: (value: CommissionOperationType) => void;
};

export function CommissionTabs({ value, onChange }: CommissionTabsProps) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      {[
        { value: "deposito" as const, label: "Depósitos" },
        { value: "retiro" as const, label: "Retiros" },
      ].map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={`min-h-9 rounded-lg px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#93C5FD] focus-visible:ring-offset-2 ${
            value === tab.value
              ? "bg-[#2563EB] text-white"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
