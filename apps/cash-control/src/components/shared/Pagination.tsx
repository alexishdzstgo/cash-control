import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: PaginationProps) {
  if (totalItems === 0) {
    return null;
  }

  const safeTotalPages = Math.max(totalPages, 1);
  const firstItem = (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <nav
      aria-label="Paginación del historial de operaciones"
      className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p
        aria-live="polite"
        className="text-sm tabular-nums text-slate-500"
      >
        Mostrando{" "}
        <span className="font-medium text-slate-700">{firstItem}</span>–
        <span className="font-medium text-slate-700">{lastItem}</span> de{" "}
        <span className="font-medium text-slate-700">{totalItems}</span>{" "}
        operaciones
      </p>

      <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
        <button
          type="button"
          onClick={() => {
            if (currentPage > 1) {
              onPageChange(currentPage - 1);
            }
          }}
          disabled={currentPage === 1}
          aria-label={
            currentPage === 1
              ? "No hay una página anterior"
              : `Ir a la página ${currentPage - 1}`
          }
          className="inline-flex min-h-9 items-center gap-1 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-600"
        >
          <ChevronLeft
            aria-hidden="true"
            className="h-4 w-4"
          />
          Anterior
        </button>

        <span className="whitespace-nowrap text-center text-sm tabular-nums text-slate-600 sm:min-w-20">
          Página{" "}
          <span className="font-semibold text-slate-800">
            {currentPage}
          </span>{" "}
          de{" "}
          <span className="font-semibold text-slate-800">
            {safeTotalPages}
          </span>
        </span>

        <button
          type="button"
          onClick={() => {
            if (currentPage < safeTotalPages) {
              onPageChange(currentPage + 1);
            }
          }}
          disabled={currentPage >= safeTotalPages}
          aria-label={
            currentPage >= safeTotalPages
              ? "No hay una página siguiente"
              : `Ir a la página ${currentPage + 1}`
          }
          className="inline-flex min-h-9 items-center gap-1 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-600"
        >
          Siguiente
          <ChevronRight
            aria-hidden="true"
            className="h-4 w-4"
          />
        </button>
      </div>
    </nav>
  );
}