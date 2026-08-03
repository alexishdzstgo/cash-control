import {
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { OperationType } from "@/types/operation";

type OperationTypeBadgeProps = {
  type: OperationType;
};

const typeConfig = {
  deposito: {
    label: "Depósito",
    icon: ArrowDownToLine,
    variant: "info" as const,
  },
  retiro: {
    label: "Retiro",
    icon: ArrowUpFromLine,
    variant: "neutral" as const,
  },
} satisfies Record<
  OperationType,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    variant: "info" | "neutral";
  }
>;

export function OperationTypeBadge({
  type,
}: OperationTypeBadgeProps) {
  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant}>
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </Badge>
  );
}