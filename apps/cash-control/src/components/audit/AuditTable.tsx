import { Eye } from "lucide-react";
import { OperationStatusBadge } from "@/components/history/OperationStatusBadge";
import { OperationTypeBadge } from "@/components/history/OperationTypeBadge";
import {
  getCorrectionDate,
  getCorrectionReason,
  getCorrectionUser,
} from "@/lib/audit";
import { formatDateTime } from "@/lib/formatters";
import type { Operation } from "@/types/operation";

type AuditTableProps = {
  operations: Operation[];
  onViewDetails: (operation: Operation) => void;
};

export function AuditTable({ operations, onViewDetails }: AuditTableProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Fecha y hora</th>
              <th className="px-4 py-3">Folio</th>
              <th className="px-4 py-3">Operación</th>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Motivo de corrección</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {operations.map((operation) => (
              <tr
                key={operation.id}
                className="bg-white transition-colors hover:bg-slate-50/70"
              >
                <td className="px-4 py-3 text-slate-500">
                  {formatDateTime(getCorrectionDate(operation))}
                </td>
                <td className="px-4 py-3 font-mono font-medium tabular-nums text-slate-700">
                  {operation.bankFolio}
                </td>
                <td className="px-4 py-3">
                  <OperationTypeBadge type={operation.type} />
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {getCorrectionUser(operation)}
                </td>
                <td className="max-w-[280px] px-4 py-3 text-slate-600">
                  <span className="line-clamp-2">
                    {getCorrectionReason(operation)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <OperationStatusBadge status={operation.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      title="Ver detalle"
                      aria-label={`Ver detalle de la operación ${operation.bankFolio}`}
                      onClick={() => onViewDetails(operation)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                    >
                      <Eye aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {operations.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  No se encontraron operaciones corregidas con los filtros
                  seleccionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
