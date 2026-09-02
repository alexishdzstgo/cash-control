import { CheckCircle2, Eye, MessageSquareText, Pencil } from "lucide-react";
import { ActionMenu } from "@/components/shared/ActionMenu";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import type { Operation } from "@/types/operation";
import { OperationStatusBadge } from "./OperationStatusBadge";
import { OperationTypeBadge } from "./OperationTypeBadge";

type OperationRowProps = {
  operation: Operation;
  onViewDetails: (operation: Operation) => void;
  onAddClarification: (operation: Operation) => void;
  onMarkAsDelivered: (operation: Operation) => void;
};

export function OperationRow({
  operation,
  onViewDetails,
  onAddClarification,
  onMarkAsDelivered,
}: OperationRowProps) {
  const clarificationCount = operation.clarifications?.length ?? 0;

  return (
    <tr className="group relative bg-white transition-colors duration-200 hover:bg-slate-50/70">
      <td className="px-4 py-3">
        <OperationTypeBadge type={operation.type} />
      </td>

      <td className="px-4 py-3 font-mono font-medium tabular-nums text-slate-700">
        {operation.bankFolio}
      </td>

      <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
        {formatCurrency(operation.amount)}
      </td>

      <td className="px-4 py-3">
        <OperationStatusBadge status={operation.status} />
      </td>

      <td className="px-4 py-3 text-slate-700">{operation.createdBy}</td>

      <td className="px-4 py-3 text-slate-500">
        {formatDateTime(operation.createdAt)}
      </td>

      <td className="px-4 py-3">
        {clarificationCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
            <MessageSquareText aria-hidden="true" className="h-3.5 w-3.5" />
            {clarificationCount === 1
              ? "Tiene aclaración"
              : `${clarificationCount} aclaraciones`}
          </span>
        ) : operation.isEdited ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
            <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
            Editado
          </span>
        ) : (
          <span className="text-xs font-medium text-slate-400">
            Sin cambios
          </span>
        )}
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            title="Ver detalle"
            aria-label={`Ver detalle de la operación ${operation.bankFolio}`}
            onClick={() => onViewDetails(operation)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            <Eye aria-hidden="true" className="h-4 w-4" />
          </button>

          {operation.status === "pendiente" && (
            <button
              type="button"
              onClick={() => onMarkAsDelivered(operation)}
              className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-amber-200 bg-amber-50 px-3 text-sm font-semibold text-amber-800 shadow-sm transition hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2 shrink-0"
            >
              <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
              Entregar
            </button>
          )}

          <ActionMenu
            items={[
              {
                label: "Agregar aclaración",
                icon: (
                  <MessageSquareText aria-hidden="true" className="h-4 w-4" />
                ),
                onClick: () => onAddClarification(operation),
              },
            ]}
          />
        </div>
      </td>
    </tr>
  );
}
