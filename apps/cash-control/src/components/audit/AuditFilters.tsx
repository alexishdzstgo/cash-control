"use client";

import { RotateCcw, Search } from "lucide-react";
import { SelectField } from "@/components/shared/SelectField";
import type { AuditFilters as AuditFilterState } from "@/lib/audit";
import type { OperationType } from "@/types/operation";

type AuditFiltersProps = {
  filters: AuditFilterState;
  users: string[];
  reasons: string[];
  operationTypes: OperationType[];
  dates: string[];
  onChange: (filters: AuditFilterState) => void;
  onClear: () => void;
};

export function AuditFilters({
  filters,
  users,
  reasons,
  operationTypes,
  dates,
  onChange,
  onClear,
}: AuditFiltersProps) {
  const hasActiveFilters =
    filters.search !== "" ||
    filters.user !== "todos" ||
    filters.operationType !== "todos" ||
    filters.reason !== "todos" ||
    filters.date !== "";

  const activeFilterCount = [
    filters.search !== "",
    filters.user !== "todos",
    filters.operationType !== "todos",
    filters.reason !== "todos",
    filters.date !== "",
  ].filter(Boolean).length;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Buscar correcciones
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Filtra por folio, usuario, tipo, motivo o fecha disponible.
          </p>
        </div>

        {activeFilterCount > 0 && (
          <span className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
            {activeFilterCount}{" "}
            {activeFilterCount === 1 ? "filtro activo" : "filtros activos"}
          </span>
        )}
      </div>

      <div className="space-y-5">
        <div>
          <label htmlFor="audit-search" className={labelClass}>
            Folio o usuario
          </label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <input
              id="audit-search"
              type="search"
              autoComplete="off"
              value={filters.search}
              onChange={(event) =>
                onChange({ ...filters, search: event.target.value })
              }
              placeholder="Buscar por folio, quien registró o quien corrigió"
              className={`${inputClass} pl-11`}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto]">
          <div>
            <label htmlFor="audit-user" className={labelClass}>
              Usuario
            </label>
            <SelectField
              id="audit-user"
              value={filters.user}
              onChange={(user) => onChange({ ...filters, user })}
              options={[
                { value: "todos", label: "Todos los usuarios" },
                ...users.map((user) => ({ value: user, label: user })),
              ]}
            />
          </div>

          <div>
            <label htmlFor="audit-type" className={labelClass}>
              Operación
            </label>
            <SelectField
              id="audit-type"
              value={filters.operationType}
              onChange={(operationType) =>
                onChange({ ...filters, operationType })
              }
              options={[
                { value: "todos", label: "Depósitos y retiros" },
                ...operationTypes.map((type) => ({
                  value: type,
                  label: type === "deposito" ? "Depósitos" : "Retiros",
                })),
              ]}
            />
          </div>

          <div>
            <label htmlFor="audit-reason" className={labelClass}>
              Motivo
            </label>
            <SelectField
              id="audit-reason"
              value={filters.reason}
              onChange={(reason) => onChange({ ...filters, reason })}
              options={[
                { value: "todos", label: "Todos los motivos" },
                ...reasons.map((reason) => ({ value: reason, label: reason })),
              ]}
            />
          </div>

          <div>
            <label htmlFor="audit-date" className={labelClass}>
              Fecha
            </label>
            <input
              id="audit-date"
              type="date"
              value={filters.date}
              min={dates[0]}
              max={dates.at(-1)}
              onChange={(event) =>
                onChange({ ...filters, date: event.target.value })
              }
              className={inputClass}
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={onClear}
              disabled={!hasActiveFilters}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-70 xl:w-auto"
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              Limpiar
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

const labelClass = "mb-2 block text-sm font-semibold text-slate-700";

const inputClass =
  "min-h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 font-sans text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:bg-white focus:ring-4 focus:ring-slate-100";
