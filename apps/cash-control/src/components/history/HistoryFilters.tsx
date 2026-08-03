import { RotateCcw, Search } from "lucide-react";
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

  const activeFilterCount = [
    search !== "",
    dateFrom !== "",
    dateTo !== "",
    statusFilter !== "todos",
    typeFilter !== "todos",
  ].filter(Boolean).length;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Buscar y filtrar operaciones
          </h2>

          <p className="mt-0.5 text-sm text-slate-500">
            Encuentra operaciones por folio, cliente, tipo, estado o fecha.
          </p>
        </div>

        {activeFilterCount > 0 && (
          <span className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
            {activeFilterCount}{" "}
            {activeFilterCount === 1
              ? "filtro activo"
              : "filtros activos"}
          </span>
        )}
      </div>

      <div className="space-y-5">
        <div>
          <label
            htmlFor="history-search"
            className={labelClass}
          >
            Buscar operación
          </label>

          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />

            <input
              id="history-search"
              type="search"
              autoComplete="off"
              value={search}
              onChange={(event) =>
                onSearchChange(event.target.value)
              }
              placeholder="Buscar por folio, remitente o destinatario"
              className={`${inputClass} pl-11`}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto]">
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

          <div>
            <label
              htmlFor="date-from"
              className={labelClass}
            >
              Fecha inicial
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
              Fecha final
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

          <div className="flex items-end">
            <button
              type="button"
              onClick={onClearFilters}
              disabled={!hasActiveFilters}
              aria-label="Limpiar todos los filtros"
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-70 xl:w-auto"
            >
              <RotateCcw
                aria-hidden="true"
                className="h-4 w-4"
              />
              Limpiar
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

const labelClass =
  "mb-2 block text-sm font-semibold text-slate-700";

const inputClass =
  "min-h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 font-sans text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:bg-white focus:ring-4 focus:ring-slate-100";