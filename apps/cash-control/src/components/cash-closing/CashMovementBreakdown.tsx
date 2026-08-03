"use client";

import { Eye } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { CashMovement, CashMovementCategory } from "@/types/cash-closing";

type CashMovementBreakdownProps = {
  movements: CashMovement[];
  onViewCategory: (category: CashMovementCategory) => void;
};

type CategorySummary = {
  category: CashMovementCategory;
  label: string;
  total: number;
  count: number;
  direction: "in" | "out";
};

const CATEGORY_META: Record<CashMovementCategory, { label: string; direction: "in" | "out" }> = {
  opening_balance: { label: "Saldo inicial", direction: "in" },
  cash_deposit: { label: "Depósitos recibidos", direction: "in" },
  commission: { label: "Comisiones cobradas", direction: "in" },
  delivered_withdrawal: { label: "Retiros entregados", direction: "out" },
  owner_withdrawal: { label: "Retiros del propietario", direction: "out" },
  authorized_adjustment: { label: "Ajustes autorizados", direction: "out" },
};

function buildCategorySummary(movements: CashMovement[]): CategorySummary[] {
  const map = new Map<CashMovementCategory, CategorySummary>();

  for (const movement of movements) {
    const existing = map.get(movement.category);

    if (existing) {
      existing.total += movement.amount;
      existing.count += 1;
      continue;
    }

    map.set(movement.category, {
      category: movement.category,
      label: CATEGORY_META[movement.category].label,
      total: movement.amount,
      count: 1,
      direction: CATEGORY_META[movement.category].direction,
    });
  }

  return Array.from(map.values());
}

export function CashMovementBreakdown({
  movements,
  onViewCategory,
}: CashMovementBreakdownProps) {
  const categories = buildCategorySummary(movements);

  if (categories.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
        <p className="text-sm text-slate-500">
          No hay movimientos registrados en este turno.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-400">
        Desglose de movimientos
      </h3>

      <div className="space-y-3">
        {categories.map((category) => (
          <div
            key={category.category}
            className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-4"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                {category.label}
              </p>
              <p className="text-xs text-slate-500">
                {category.count} {category.count === 1 ? "operación" : "operaciones"}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`text-sm font-semibold ${
                  category.direction === "in"
                    ? "text-emerald-700"
                    : "text-red-600"
                }`}
              >
                {category.direction === "in" ? "+" : "\u2212"}
                {formatCurrency(category.total)}
              </span>
              <button
                type="button"
                onClick={() => onViewCategory(category.category)}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-800"
              >
                <Eye className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Ver operaciones</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}