"use client";

import Link from "next/link";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import type { Shift } from "@/types/shift";

export const closingResultLabels = {
  balanced: "Cuadrado",
  shortage: "Faltante",
  surplus: "Sobrante",
};

export function CashClosingResult({
  shift,
  showHistoryLink = true,
}: {
  shift: Shift;
  showHistoryLink?: boolean;
}) {
  const closing = shift.closing;
  if (!closing) return null;
  const tone = {
    balanced: "text-emerald-700",
    shortage: "text-red-700",
    surplus: "text-blue-700",
  }[closing.status];
  const rows = [
    {
      id: "cash",
      name: "Caja física total",
      expected: closing.expectedCashPhysical,
      counted: closing.countedCashPhysical,
      difference: closing.countedCashPhysical - closing.expectedCashPhysical,
    },
    {
      id: "reserved",
      name: "Apartado (incluido en caja física)",
      expected: closing.expectedReservedCash,
      counted: closing.countedReservedCash,
      difference: closing.countedReservedCash - closing.expectedReservedCash,
    },
    ...closing.banks.map((bank) => ({
      id: bank.bankId,
      name: bank.bankName,
      expected: bank.expectedBalance,
      counted: bank.countedBalance,
      difference: bank.difference,
    })),
  ];
  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-500">Turno cerrado · {shift.folio}</p>
        <h2 className={`mt-1 text-2xl font-bold ${tone}`}>
          {closingResultLabels[closing.status]}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Cerrado el {formatDateTime(closing.closedAt)} por{" "}
          {closing.closedByUserName}.
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Responsable: {shift.responsibleUserName}
        </p>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-bold text-slate-900">
          Resultado del conteo
        </h3>
        <div className="mt-4 space-y-4">
          {rows.map((row) => (
            <div
              key={row.id}
              className="border-b border-slate-100 pb-3 last:border-0"
            >
              <p className="text-sm font-semibold text-slate-800">{row.name}</p>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-xs tabular-nums sm:text-sm">
                <div>
                  <dt className="text-slate-500">Esperado</dt>
                  <dd>{formatCurrency(row.expected)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Contado</dt>
                  <dd>{formatCurrency(row.counted)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Diferencia</dt>
                  <dd className="font-semibold">
                    {formatCurrency(row.difference)}
                  </dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
        <p className="mt-4 flex justify-between gap-3 text-sm font-bold text-slate-900">
          Diferencia total{" "}
          <span className="tabular-nums">
            {formatCurrency(closing.totalDifference)}
          </span>
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Incluye caja física y bancos. El apartado forma parte de la caja
          física.
        </p>
        {closing.status !== "balanced" && closing.totalDifference === 0 && (
          <p className="mt-2 text-sm text-slate-600">
            Hay diferencias entre recursos aunque la diferencia total sea cero.
          </p>
        )}
        {closing.observations && (
          <div className="mt-4 text-sm text-slate-700">
            <p className="font-semibold">Observaciones</p>
            <p className="mt-1 whitespace-pre-wrap">{closing.observations}</p>
          </div>
        )}
      </section>
      {showHistoryLink && (
        <Link href="/shifts" className="btn-secondary">
          Ver historial de turnos
        </Link>
      )}
    </div>
  );
}
