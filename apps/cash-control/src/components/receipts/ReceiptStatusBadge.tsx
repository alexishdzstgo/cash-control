import type { ReceiptStatus } from "@/types/receipt";

const statusLabels: Record<ReceiptStatus, string> = {
  pending: "PENDIENTE",
  completed: "COMPLETADO",
  delivered: "ENTREGADO",
};

export function ReceiptStatusBadge({ status }: { status: ReceiptStatus }) {
  return (
    <span className="inline-block border border-black px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
      {statusLabels[status]}
    </span>
  );
}
