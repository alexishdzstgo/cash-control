import { CheckCircle2, Clock3 } from "lucide-react";
import type { OperationStatus } from "@/types/operation";

type OperationStatusBadgeProps = {
  status: OperationStatus;
};

const statusConfig = {
  pendiente: {
    label: "Pendiente",
    icon: Clock3,
    className: "bg-amber-100 text-amber-700",
  },
  entregado: {
    label: "Entregado",
    icon: CheckCircle2,
    className: "bg-emerald-100 text-emerald-700",
  },
} satisfies Record<
  OperationStatus,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    className: string;
  }
>;

export function OperationStatusBadge({
  status,
}: OperationStatusBadgeProps) {
  const config = statusConfig[status];
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