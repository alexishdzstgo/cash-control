import { CheckCircle2, Clock3, XCircle, CheckCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { OperationStatus } from "@/types/operation";

type OperationStatusBadgeProps = {
  status: OperationStatus;
};

const statusConfig = {
  pendiente: {
    label: "Pendiente",
    icon: Clock3,
    variant: "alert" as const,
  },
  completado: {
    label: "Completado",
    icon: CheckCheck,
    variant: "info" as const,
  },
  entregado: {
    label: "Entregado",
    icon: CheckCircle2,
    variant: "success" as const,
  },
  cancelado: {
    label: "Cancelado",
    icon: XCircle,
    variant: "error" as const,
  },
} satisfies Record<
  OperationStatus,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    variant: "success" | "info" | "alert" | "error";
  }
>;

export function OperationStatusBadge({
  status,
}: OperationStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant}>
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </Badge>
  );
}