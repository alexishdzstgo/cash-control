import { RotateCcw } from "lucide-react";
import { SelectField } from "@/components/shared/SelectField";
import type {
  OperationStatus,
  OperationType,
} from "@/types/operation";

type HistoryFiltersProps = {
  search: string;
  dateFrom: string;
  dateTo: string;
  statusFilter: "todos" | OperationStatus;
  typeFilter: "todos" | OperationType;
  onSearchChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onStatusFilterChange: (
    value: "todos" | OperationStatus,
  ) => void;
  onTypeFilterChange: (
    value: "todos" | OperationType,
  ) => void;
  onClearFilters: () => void;
};

export function HistoryFilters({
  search,
  dateFrom,
  dateTo,
  statusFilter,
  typeFilter,
  onSearchChange,
  onDateFromChange,
  onDateToChange,
  onStatusFilterChange,
  onTypeFilterChange,
  onClearFilters,
}: HistoryFiltersProps) {
  const hasActiveFilters =
    search !== "" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    statusFilter !== "todos" ||
    typeFilter !== "todos";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <label
            htmlFor="history-search"
            className={labelClass}
          >
            Buscar operación
          </label>

          <input
            id="history-search"
            value={search}
            onChange={(event) =>
              onSearchChange(event.target.value)
            }
            placeholder="Folio, nombre de quien envía o recibe"
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="operation-type"
            className={labelClass}
          >
            Tipo de operación
          </label>

          <SelectField
            id="operation-type"
            value={typeFilter}
            onChange={onTypeFilterChange}
            options={[
              {
                value: "todos",
                label: "Todos los tipos",
              },
              {
                value: "deposito",
                label: "Depósitos",
              },
              {
                value: "retiro",
                label: "Retiros",
              },
            ]}
          />
        </div>

        <div>
          <label
            htmlFor="operation-status"
            className={labelClass}
          >
            Estado
          </label>

          <SelectField
            id="operation-status"
            value={statusFilter}
            onChange={onStatusFilterChange}
            options={[
              {
                value: "todos",
                label: "Todos los estados",
              },
              {
                value: "pendiente",
                label: "Pendientes",
              },
              {
                value: "entregado",
                label: "Entregados",
              },
            ]}
          />
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={onClearFilters}
            disabled={!hasActiveFilters}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            <RotateCcw className="h-4 w-4" />
            Limpiar
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2 xl:max-w-xl">
        <div>
          <label
            htmlFor="date-from"
            className={labelClass}
          >
            Desde
          </label>

          <input
            id="date-from"
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(event) =>
              onDateFromChange(event.target.value)
            }
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="date-to"
            className={labelClass}
          >
            Hasta
          </label>

          <input
            id="date-to"
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(event) =>
              onDateToChange(event.target.value)
            }
            className={inputClass}
          />
        </div>
      </div>
    </section>
  );
}

const labelClass =
  "mb-2 block text-base font-semibold text-slate-800";

const inputClass =
  "min-h-12 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 font-sans text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50";