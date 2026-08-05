"use client";

import { useMemo, useState } from "react";
import { useBusinessFunds } from "@/components/business-funds/BusinessFundsContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { getAdministrativeMovementsSummary } from "@/lib/administrativeMovements";
import { formatCurrency } from "@/lib/formatters";
import type {
  CashClosingStatus,
  CashMovementCategory,
} from "@/types/cash-closing";
import { CashClosingConfirmation } from "./CashClosingConfirmation";
import { CashClosingResult } from "./CashClosingResult";
import { CashDifferenceCard } from "./CashDifferenceCard";
import { CashMovementBreakdown } from "./CashMovementBreakdown";
import { mockCashClosingData } from "./cashClosingMockData";
import { ExpectedCashSummary } from "./ExpectedCashSummary";
import { MovementDetailsModal } from "./MovementDetailsModal";
import { PhysicalCashCount } from "./PhysicalCashCount";
import { ShiftClosingHeader } from "./ShiftClosingHeader";

type CashClosingPageState = {
  status: CashClosingStatus;
  countedCash: string;
  observations: string;
  activeCategory: CashMovementCategory | null;
};

const INITIAL_STATE: CashClosingPageState = {
  status: "pending",
  countedCash: "",
  observations: "",
  activeCategory: null,
};

export function CashClosingPage() {
  const { movements: administrativeMovements } = useBusinessFunds();
  const [state, setState] = useState<CashClosingPageState>(INITIAL_STATE);

  const { shift, openingBalance, movements, reservedCash } =
    mockCashClosingData;

  const totalEntries = useMemo(
    () =>
      movements
        .filter((movement) => movement.direction === "in")
        .reduce((sum, movement) => sum + movement.amount, 0),
    [movements],
  );

  const totalOutputs = useMemo(
    () =>
      movements
        .filter((movement) => movement.direction === "out")
        .reduce((sum, movement) => sum + movement.amount, 0),
    [movements],
  );

  const expectedCash = openingBalance + totalEntries - totalOutputs;
  const availableCash = expectedCash - reservedCash;
  const administrativeSummary = useMemo(
    () => getAdministrativeMovementsSummary(administrativeMovements),
    [administrativeMovements],
  );

  const countedNumeric =
    state.countedCash === "" ? NaN : Number(state.countedCash);
  const hasCountedValue =
    state.countedCash !== "" && !Number.isNaN(countedNumeric);
  const difference = hasCountedValue ? countedNumeric - expectedCash : NaN;

  const handleStartCount = () => {
    setState((prev) => ({ ...prev, status: "in_progress" }));
  };

  const handleCountedCashChange = (value: string) => {
    setState((prev) => ({ ...prev, countedCash: value }));
  };

  const handleViewCategory = (category: CashMovementCategory) => {
    setState((prev) => ({ ...prev, activeCategory: category }));
  };

  const handleCloseModal = () => {
    setState((prev) => ({ ...prev, activeCategory: null }));
  };

  const handleConfirm = () => {
    if (!hasCountedValue) return;

    const differenceCents = Math.round(difference * 100);

    let nextStatus: CashClosingStatus;
    if (differenceCents === 0) {
      nextStatus = "balanced";
    } else if (differenceCents < 0) {
      nextStatus = "shortage";
    } else {
      nextStatus = "surplus";
    }

    setState((prev) => ({ ...prev, status: nextStatus }));
  };

  const handleReset = () => {
    setState(INITIAL_STATE);
  };

  const isClosingDone =
    state.status === "balanced" ||
    state.status === "shortage" ||
    state.status === "surplus";

  const activeCategoryMovements = state.activeCategory
    ? movements.filter((movement) => movement.category === state.activeCategory)
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Corte de caja"
        description="Compara el efectivo registrado por el sistema con el dinero contado al finalizar el turno."
      />

      <ShiftClosingHeader shift={shift} />

      {isClosingDone ? (
        <CashClosingResult
          status={state.status}
          countedCash={state.countedCash}
          expectedCash={expectedCash}
          difference={difference}
          shiftName={shift.name}
          responsibleName={shift.responsibleName}
          observations={state.observations}
          onReset={handleReset}
        />
      ) : (
        <>
          <ExpectedCashSummary
            openingBalance={openingBalance}
            totalEntries={totalEntries}
            totalOutputs={totalOutputs}
            expectedCash={expectedCash}
            reservedCash={reservedCash}
            availableCash={availableCash}
          />

          <CashMovementBreakdown
            movements={movements}
            onViewCategory={handleViewCategory}
          />

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-400">
              Movimientos administrativos
            </h3>
            <div className="grid gap-3 md:grid-cols-3">
              <AdminSummaryItem
                label="Ingresos administrativos"
                value={administrativeSummary.incomeTodayCents}
              />
              <AdminSummaryItem
                label="Retiros administrativos"
                value={administrativeSummary.withdrawalTodayCents}
              />
              <AdminSummaryItem
                label="Balance neto administrativo"
                value={administrativeSummary.netTodayCents}
              />
            </div>
          </div>

          {state.status === "pending" && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-center">
              <p className="text-sm text-slate-600">
                Inicia el conteo físico para capturar el efectivo presente en
                caja.
              </p>
              <button
                type="button"
                onClick={handleStartCount}
                className="mt-4 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-primary-hover"
              >
                Iniciar conteo
              </button>
            </div>
          )}

          {state.status === "in_progress" && (
            <div className="space-y-6">
              <PhysicalCashCount
                countedCash={state.countedCash}
                onCountedCashChange={handleCountedCashChange}
              />

              <CashDifferenceCard
                countedCash={state.countedCash}
                expectedCash={expectedCash}
              />

              <CashClosingConfirmation
                status={state.status}
                countedCash={state.countedCash}
                expectedCash={expectedCash}
                difference={difference}
                onConfirm={handleConfirm}
              />
            </div>
          )}
        </>
      )}

      <MovementDetailsModal
        isOpen={state.activeCategory !== null}
        onClose={handleCloseModal}
        category={state.activeCategory ?? "cash_deposit"}
        movements={activeCategoryMovements}
      />
    </div>
  );
}

function AdminSummaryItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-bold text-slate-950">
        {formatCurrency(value / 100)}
      </p>
    </div>
  );
}
