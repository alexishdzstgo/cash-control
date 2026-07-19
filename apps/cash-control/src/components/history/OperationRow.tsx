import { formatDateTime } from "@/lib/formatters";
import { OperationStatusBadge } from "./OperationStatusBadge";
import { OperationTypeBadge } from "./OperationTypeBadge";
import {
  CheckCircle2,
  Eye,
  FileText,
  History,
  Pencil,
  Printer,
} from "lucide-react";
import { ActionMenu } from "@/components/shared/ActionMenu";
import type { Operation } from "@/types/operation";

type OperationRowProps = {
  operation: Operation;
  onViewDetails: (operation: Operation) => void;
  onMarkAsDelivered: (operation: Operation) => void;
};

export function OperationRow({
  operation,
  onViewDetails,
  onMarkAsDelivered,
}: OperationRowProps) {
  const isDelivered = operation.status === "entregado";

  return (
    <tr className={operation.isEdited ? "bg-red-50" : "bg-white"}>
      <td className="px-4 py-3">
  <OperationTypeBadge type={operation.type} />
</td>

      <td className="px-4 py-3 font-mono text-slate-700">
        {operation.bankFolio}
      </td>

<td className="px-4 py-3">
  <OperationStatusBadge status={operation.status} />
</td>

      <td className="px-4 py-3 text-slate-700">{operation.createdBy}</td>

      <td className="px-4 py-3 text-slate-500">
        {formatDateTime(operation.createdAt)}
      </td>

      <td className="px-4 py-3">
        {operation.isEdited ? (
          <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-600">
            Editado
          </span>
        ) : (
          <span className="text-xs text-slate-400">Sin cambios</span>
        )}
      </td>

      <td className="px-4 py-3">
        <button
          type="button"
          title={
            isDelivered
              ? "La operación ya está entregada"
              : "Marcar como entregada"
          }
          onClick={() => onMarkAsDelivered(operation)}
          disabled={isDelivered}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-600"
        >
          <CheckCircle2 className="h-4 w-4" />
        </button>
      </td>

      <td className="px-4 py-3">
        <button
          type="button"
          title="Ver detalle"
          onClick={() => onViewDetails(operation)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
        >
          <Eye className="h-4 w-4" />
        </button>
      </td>

      <td className="px-4 py-3">
        <ActionMenu
          items={[
            {
              label: "Editar operación",
              icon: <Pencil className="h-4 w-4" />,
              onClick: () => console.log("Editar operación:", operation),
            },
            {
              label: "Ver ticket",
              icon: <FileText className="h-4 w-4" />,
              onClick: () => console.log("Ver ticket:", operation),
            },
            {
              label: "Imprimir ticket",
              icon: <Printer className="h-4 w-4" />,
              onClick: () => console.log("Imprimir ticket:", operation),
            },
            {
              label: "Historial de cambios",
              icon: <History className="h-4 w-4" />,
              onClick: () => console.log("Historial de cambios:", operation),
            },
          ]}
        />
      </td>
    </tr>
  );
}