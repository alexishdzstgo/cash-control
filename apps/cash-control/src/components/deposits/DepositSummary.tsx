interface DepositSummaryProps {
  isReadyToRegister: boolean;
}

export function DepositSummary({ isReadyToRegister }: DepositSummaryProps) {
  return (
    <aside className="sticky top-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">
        Resumen de entrega
      </h2>

      <div className="mt-6 space-y-4">
        <Row label="Monto" value="$0.00" />
        <Row label="Comisión" value="$0.00" />

        <div className="border-t border-slate-100 pt-4">
          <Row label="Total a cobrar" value="$0.00" large />
        </div>
      </div>

      <button
        disabled={!isReadyToRegister}
        className={
          isReadyToRegister
            ? "mt-8 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700"
            : "mt-8 w-full cursor-not-allowed rounded-xl bg-slate-300 px-4 py-3 font-semibold text-slate-500 transition"
        }
      >
        Registrar entrega
      </button>

      <p className="mt-4 text-center text-sm text-slate-500">
        Después de registrar, se podrá imprimir el ticket.
      </p>
    </aside>
  );
}

function Row({
  label,
  value,
  large = false,
}: {
  label: string;
  value: string;
  large?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-slate-500">{label}</span>
      <span
        className={
          large
            ? "text-2xl font-bold text-slate-950"
            : "font-semibold text-slate-950"
        }
      >
        {value}
      </span>
    </div>
  );
}