import {
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";
import type { OperationType } from "@/types/operation";

type OperationTypeBadgeProps = {
  type: OperationType;
};

const typeConfig = {
  deposito: {
    label: "Depósito",
    icon: ArrowDownToLine,
    className: "bg-deposit-100 text-deposit-700",
  },
  retiro: {
    label: "Retiro",
    icon: ArrowUpFromLine,
    className: "bg-withdrawal-100 text-withdrawal-700",
  },
} satisfies Record<
  OperationType,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    className: string;
  }
>;

export function OperationTypeBadge({
  type,
}: OperationTypeBadgeProps) {
  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}