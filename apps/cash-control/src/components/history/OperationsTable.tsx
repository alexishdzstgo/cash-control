import { Pagination } from "@/components/shared/Pagination";
import type { Operation } from "@/types/operation";
import { OperationRow } from "./OperationRow";

type OperationsTableProps = {
  operations: Operation[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onViewDetails: (operation: Operation) => void;
  onAddClarification: (operation: Operation) => void;
  onMarkAsDelivered: (operation: Operation) => void;
};

export function OperationsTable({
  operations,
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onViewDetails,
  onAddClarification,
  onMarkAsDelivered,
}: OperationsTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase text-slate-500 font-semibold tracking-wide">
            <tr>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Folio</th>
              <th className="px-4 py-3 text-right">Monto</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Auditoría</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {operations.map((operation) => (
              <OperationRow
                key={operation.id}
                operation={operation}
                onViewDetails={onViewDetails}
                onAddClarification={onAddClarification}
                onMarkAsDelivered={onMarkAsDelivered}
              />
            ))}

            {operations.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-slate-500"
                >
                  No se encontraron operaciones.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={onPageChange}
      />
    </div>
  );
}
