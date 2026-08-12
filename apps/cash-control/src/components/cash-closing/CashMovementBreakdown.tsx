"use client";

import { Eye } from "lucide-react";
import { CASH_CLOSING_CATEGORY_META } from "@/lib/cashClosing";
import { formatCurrency } from "@/lib/formatters";
import type { CashMovement, CashMovementCategory } from "@/types/cash-closing";

type CashMovementBreakdownProps = {
  movements: CashMovement[];
  title?: string;
  emptyMessage?: string;
  onViewCategory: (category: CashMovementCategory) => void;
};

type CategorySummary = {
  category: CashMovementCategory;
  label: string;
  helperText: string;
  total: number;
  count: number;
  direction: "in" | "out";
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

    const meta = CASH_CLOSING_CATEGORY_META[movement.category];
    map.set(movement.category, {
      category: movement.category,
      label: meta.label,
      helperText: meta.helperText,
      total: movement.amount,
      count: 1,
      direction: meta.direction,
    });
  }

  return Array.from(map.values());
}

export function CashMovementBreakdown({
  movements,
  title = "Movimientos que explican esta parte",
  emptyMessage = "No hay movimientos registrados en este turno.",
  onViewCategory,
}: CashMovementBreakdownProps) {
  const categories = buildCategorySummary(movements);

  if (categories.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-400">
        {title}
      </h3>

      <div className="space-y-3">
        {categories.map((category) => (
          <div
            key={category.category}
            className="flex flex-col gap-3 rounded-lg border border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                {category.label}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {category.helperText}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {category.count}{" "}
                {category.count === 1 ? "movimiento" : "movimientos"}
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <span
                className={`text-sm font-semibold tabular-nums ${
                  category.direction === "in"
                    ? "text-emerald-700"
                    : "text-orange-700"
                }`}
              >
                {category.direction === "in" ? "+" : "-"}
                {formatCurrency(category.total)}
              </span>
              <button
                type="button"
                onClick={() => onViewCategory(category.category)}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-800"
              >
                <Eye className="h-3.5 w-3.5 shrink-0" />
                <span>Ver movimientos</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
