export function QuickActions() {
  return (
    <section >

      <div className="grid gap-4 md:grid-cols-2">
        <button className="group relative cursor-pointer rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
          <span className="absolute left-0 top-1/2 h-10 w-1 -translate-y-1/2 rounded-r-full bg-blue-500" />

          <p className="text-lg font-semibold text-slate-900">
            Nuevo depósito
          </p>

          <p className="mt-2 text-sm text-slate-500">
            Registrar la entrega de un depósito bancario.
          </p>
        </button>

        <button className="group relative cursor-pointer rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
          <span className="absolute left-0 top-1/2 h-10 w-1 -translate-y-1/2 rounded-r-full bg-blue-500" />

          <p className="text-lg font-semibold text-slate-900">
            Nueva transferencia
          </p>

          <p className="mt-2 text-sm text-slate-500">
            Registrar una transferencia bancaria.
          </p>
        </button>
      </div>
    </section>
  );
}