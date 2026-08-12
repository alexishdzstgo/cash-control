"use client";

import {
  ArrowDown,
  ArrowUp,
  Banknote,
  ClipboardList,
  Eye,
  PiggyBank,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useBusinessFunds } from "@/components/business-funds/BusinessFundsContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { buildCashClosingStory } from "@/lib/cashClosing";
import { formatCurrency } from "@/lib/formatters";
import type {
  CashClosingStatus,
  CashMovement,
  CashMovementCategory,
} from "@/types/cash-closing";
import { CashClosingConfirmation } from "./CashClosingConfirmation";
import { CashClosingResult } from "./CashClosingResult";
import { CashDifferenceCard } from "./CashDifferenceCard";
import { CashMovementBreakdown } from "./CashMovementBreakdown";
import { mockCashClosingData } from "./cashClosingMockData";
import { MovementDetailsModal } from "./MovementDetailsModal";
import { PhysicalCashCount } from "./PhysicalCashCount";
import { ShiftClosingHeader } from "./ShiftClosingHeader";

type CashClosingMode = "review" | "count" | "done";

type CashClosingPageState = {
  mode: CashClosingMode;
  status: CashClosingStatus;
  countedCash: string;
  observations: string;
  activeDetail: {
    category: CashMovementCategory;
    movements: CashMovement[];
  } | null;
};

const INITIAL_STATE: CashClosingPageState = {
  mode: "review",
  status: "pending",
  countedCash: "",
  observations: "",
  activeDetail: null,
};

export function CashClosingPage() {
  const {
    cash,
    banks,
    movements: administrativeMovements,
    operations,
  } = useBusinessFunds();
  const [state, setState] = useState<CashClosingPageState>(INITIAL_STATE);

  const story = useMemo(
    () =>
      buildCashClosingStory({
        cash,
        banks,
        operations,
        administrativeMovements,
        fallbackOpeningBalance: mockCashClosingData.openingBalance,
      }),
    [cash, banks, operations, administrativeMovements],
  );

  const countedNumeric =
    state.countedCash === "" ? NaN : Number(state.countedCash);
  const hasCountedValue =
    state.countedCash !== "" && !Number.isNaN(countedNumeric);
  const difference = hasCountedValue
    ? countedNumeric - story.expectedCash
    : NaN;

  function handleStartCount() {
    setState((current) => ({
      ...current,
      mode: "count",
      status: "in_progress",
    }));
  }

  function handleBackToReview() {
    setState((current) => ({ ...current, mode: "review", status: "pending" }));
  }

  function handleConfirm(observations: string) {
    if (!hasCountedValue) return;

    const differenceCents = Math.round(difference * 100);
    const nextStatus =
      differenceCents === 0
        ? "balanced"
        : differenceCents < 0
          ? "shortage"
          : "surplus";

    setState((current) => ({
      ...current,
      mode: "done",
      status: nextStatus,
      observations,
    }));
  }

  function handleViewCategory(category: CashMovementCategory) {
    setState((current) => ({
      ...current,
      activeDetail: {
        category,
        movements: story.allMovements.filter(
          (movement) => movement.category === category,
        ),
      },
    }));
  }

  function handleViewReserved() {
    setState((current) => ({
      ...current,
      activeDetail: {
        category: "delivered_withdrawal",
        movements: story.reservedCash.movements,
      },
    }));
  }

  function handleCloseDetail() {
    setState((current) => ({ ...current, activeDetail: null }));
  }

  function handleReset() {
    setState(INITIAL_STATE);
  }

  if (state.mode === "done") {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Corte de caja"
          description="Resumen final del turno cerrado en esta demostración mock."
        />
        <CashClosingResult
          status={state.status}
          countedCash={state.countedCash}
          expectedCash={story.expectedCash}
          difference={difference}
          shiftName={mockCashClosingData.shift.name}
          responsibleName={mockCashClosingData.shift.responsibleName}
          observations={state.observations}
          onReset={handleReset}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28">
      <PageHeader
        title="Corte de caja"
        description="Entiende de dónde salió cada peso antes de cerrar el turno."
      />

      <ShiftClosingHeader shift={mockCashClosingData.shift} />

      {state.mode === "review" ? (
        <>
          <TurnStoryHero expectedCash={story.expectedCash} />

          <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
            <CashStoryCard
              openingBalance={story.openingBalance}
              totalEntries={story.totalEntries}
              totalOutputs={story.totalOutputs}
              expectedCash={story.expectedCash}
            />
            <ReservedCashCard
              reservedCash={story.reservedCash.total}
              availableCash={story.availableCash}
              movements={story.reservedCash.movements}
              onViewReserved={handleViewReserved}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <CashMovementBreakdown
              title="Entró a caja"
              movements={story.allMovements.filter(
                (movement) => movement.direction === "in",
              )}
              emptyMessage="No hay entradas de efectivo registradas en este turno."
              onViewCategory={handleViewCategory}
            />
            <CashMovementBreakdown
              title="Salió de caja"
              movements={story.allMovements.filter(
                (movement) => movement.direction === "out",
              )}
              emptyMessage="No hay salidas de efectivo registradas en este turno."
              onViewCategory={handleViewCategory}
            />
          </section>

          <CommissionProfitCard
            total={story.commissionProfit.totalCommissionProfit}
            depositTotal={story.commissionProfit.depositCommissionProfit}
            withdrawalTotal={story.commissionProfit.withdrawalCommissionProfit}
            cashTotal={story.commissionProfit.cashCommissionProfit}
            bankTotal={story.commissionProfit.bankCommissionProfit}
            bankBreakdown={story.commissionProfit.bankBreakdown}
          />

          <StickyReviewBar
            expectedCash={story.expectedCash}
            onStartCount={handleStartCount}
          />
        </>
      ) : (
        <section className="space-y-6">
          <CountModeHeader
            expectedCash={story.expectedCash}
            reservedCash={story.reservedCash.total}
            availableCash={story.availableCash}
          />

          <PhysicalCashCount
            countedCash={state.countedCash}
            onCountedCashChange={(countedCash) =>
              setState((current) => ({ ...current, countedCash }))
            }
          />

          <CashDifferenceCard
            countedCash={state.countedCash}
            expectedCash={story.expectedCash}
          />

          {hasCountedValue && Math.round(difference * 100) !== 0 && (
            <InvestigationLinks />
          )}

          <CashClosingConfirmation
            status={state.status}
            countedCash={state.countedCash}
            expectedCash={story.expectedCash}
            openingBalance={story.openingBalance}
            totalEntries={story.totalEntries}
            totalOutputs={story.totalOutputs}
            reservedCash={story.reservedCash.total}
            availableCash={story.availableCash}
            commissionProfit={story.commissionProfit}
            difference={difference}
            onBack={handleBackToReview}
            onConfirm={handleConfirm}
          />
        </section>
      )}

      <MovementDetailsModal
        isOpen={state.activeDetail !== null}
        onClose={handleCloseDetail}
        category={state.activeDetail?.category ?? "cash_deposit"}
        movements={state.activeDetail?.movements ?? []}
      />
    </div>
  );
}

function TurnStoryHero({ expectedCash }: { expectedCash: number }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
        Según los movimientos registrados
      </p>
      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-950 tabular-nums md:text-4xl">
            {formatCurrency(expectedCash)}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Este es el efectivo que debería existir físicamente: lo que había al
            comenzar, más lo que entró y menos lo que salió.
          </p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Primero revisa la historia del dinero. Después inicia el conteo.
        </div>
      </div>
    </section>
  );
}

function CashStoryCard({
  openingBalance,
  totalEntries,
  totalOutputs,
  expectedCash,
}: {
  openingBalance: number;
  totalEntries: number;
  totalOutputs: number;
  expectedCash: number;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-bold text-slate-950">
        Cómo llegamos a esta cantidad
      </h3>
      <p className="mt-1 text-sm text-slate-500">
        La fórmula reconstruye el efectivo esperado desde la historia real del
        turno.
      </p>

      <div className="mt-5 space-y-3">
        <StoryLine
          icon={Wallet}
          label="Caja al iniciar"
          helper="Lo que había al comenzar el turno."
          value={openingBalance}
          tone="neutral"
        />
        <StoryLine
          icon={ArrowUp}
          label="Entró a caja"
          helper="Dinero físico que llegó durante el turno."
          value={totalEntries}
          tone="in"
          sign="+"
        />
        <StoryLine
          icon={ArrowDown}
          label="Salió de caja"
          helper="Dinero físico entregado o retirado."
          value={totalOutputs}
          tone="out"
          sign="-"
        />
        <div className="border-t border-slate-100 pt-3">
          <StoryLine
            icon={Banknote}
            label="Efectivo que debería existir"
            helper="Lo que debería haber físicamente según los movimientos."
            value={expectedCash}
            tone="strong"
          />
        </div>
      </div>
    </section>
  );
}

function ReservedCashCard({
  reservedCash,
  availableCash,
  movements,
  onViewReserved,
}: {
  reservedCash: number;
  availableCash: number;
  movements: CashMovement[];
  onViewReserved: () => void;
}) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
      <h3 className="text-lg font-bold text-slate-950">
        Dinero apartado para retiros pendientes
      </h3>
      <p className="mt-1 text-sm text-slate-600">
        Este dinero sí está físicamente en el negocio, pero está separado porque
        corresponde a retiros que todavía no se han entregado.
      </p>

      <div className="mt-5 space-y-3">
        <StoryLine
          icon={PiggyBank}
          label="Apartado para retiros pendientes"
          helper={`${movements.length} ${movements.length === 1 ? "retiro pendiente" : "retiros pendientes"}`}
          value={reservedCash}
          tone="reserved"
        />
        <StoryLine
          icon={Wallet}
          label="Disponible para trabajar"
          helper="Lo que queda libre después de considerar lo apartado."
          value={availableCash}
          tone="strong"
        />
      </div>

      {movements.length > 0 && (
        <button
          type="button"
          onClick={onViewReserved}
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-amber-800 transition hover:text-amber-950"
        >
          <Eye className="h-4 w-4" />
          Ver retiros pendientes
        </button>
      )}
    </section>
  );
}

function CommissionProfitCard({
  total,
  depositTotal,
  withdrawalTotal,
  cashTotal,
  bankTotal,
  bankBreakdown,
}: {
  total: number;
  depositTotal: number;
  withdrawalTotal: number;
  cashTotal: number;
  bankTotal: number;
  bankBreakdown: Array<{ id: string; label: string; amount: number }>;
}) {
  return (
    <section className="rounded-2xl border border-cyan-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-950">
            Ganancia del turno
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Es la suma de las comisiones generadas durante el turno. Fondos del
            negocio no se consideran ganancia.
          </p>
        </div>
        <p className="text-3xl font-bold text-cyan-700 tabular-nums">
          {formatCurrency(total)}
        </p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <MiniBreakdown
          title="De dónde salió"
          rows={[
            ["Depósitos", depositTotal],
            ["Retiros", withdrawalTotal],
          ]}
        />
        <MiniBreakdown
          title="Dónde quedó"
          rows={[
            ["Caja física", cashTotal],
            ["Bancos", bankTotal],
            ...bankBreakdown.map((bank) => [bank.label, bank.amount] as const),
          ]}
        />
      </div>
    </section>
  );
}

function CountModeHeader({
  expectedCash,
  reservedCash,
  availableCash,
}: {
  expectedCash: number;
  reservedCash: number;
  availableCash: number;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-950">Conteo de caja</h2>
      <p className="mt-1 text-sm text-slate-500">
        Ahora captura el efectivo que contaste físicamente.
      </p>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <CompactMetric
          label="Efectivo esperado"
          helper="Lo que debería existir según el sistema."
          value={expectedCash}
        />
        <CompactMetric
          label="Apartado para retiros"
          helper="Efectivo comprometido por retiros pendientes."
          value={reservedCash}
        />
        <CompactMetric
          label="Disponible"
          helper="Efectivo libre para seguir trabajando."
          value={availableCash}
        />
      </div>
    </section>
  );
}

function InvestigationLinks() {
  const links = [
    ["/history", "Movimientos del turno"],
    ["/deposits", "Depósitos"],
    ["/withdrawals", "Retiros"],
    ["/business-funds", "Fondos del negocio"],
    ["/pending-withdrawals", "Retiros pendientes"],
    ["/audit", "Auditoría"],
  ] as const;

  return (
    <section className="rounded-xl border border-blue-200 bg-blue-50 p-5">
      <h3 className="text-sm font-bold uppercase tracking-wide text-blue-700">
        Antes de cerrar, puedes revisar
      </h3>
      <p className="mt-1 text-sm text-blue-800">
        El sistema no inventa la causa de una diferencia, pero te deja volver a
        los lugares donde se originan los movimientos.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {links.map(([href, label]) => (
          <a
            key={href}
            href={href}
            className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
          >
            {label}
          </a>
        ))}
      </div>
    </section>
  );
}

function StickyReviewBar({
  expectedCash,
  onStartCount,
}: {
  expectedCash: number;
  onStartCount: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-30 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:mx-0 sm:rounded-t-2xl sm:border-x">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Efectivo esperado
          </p>
          <p className="text-xl font-bold text-slate-950 tabular-nums">
            {formatCurrency(expectedCash)}
          </p>
        </div>
        <button type="button" onClick={onStartCount} className="btn-primary">
          <ClipboardList className="h-4 w-4" />
          Iniciar conteo
        </button>
      </div>
    </div>
  );
}

function StoryLine({
  icon: Icon,
  label,
  helper,
  value,
  tone,
  sign = "",
}: {
  icon: typeof Wallet;
  label: string;
  helper: string;
  value: number;
  tone: "neutral" | "in" | "out" | "reserved" | "strong";
  sign?: string;
}) {
  const toneClass = {
    neutral: "text-slate-900 bg-slate-100",
    in: "text-emerald-700 bg-emerald-50",
    out: "text-orange-700 bg-orange-50",
    reserved: "text-amber-700 bg-amber-100",
    strong: "text-slate-950 bg-blue-50",
  }[tone];
  const valueClass = {
    neutral: "text-slate-900",
    in: "text-emerald-700",
    out: "text-orange-700",
    reserved: "text-amber-700",
    strong: "text-slate-950",
  }[tone];

  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className={`rounded-lg p-2 ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{label}</p>
          <p className="mt-1 text-xs text-slate-500">{helper}</p>
        </div>
      </div>
      <p className={`shrink-0 text-sm font-bold tabular-nums ${valueClass}`}>
        {sign}
        {formatCurrency(value)}
      </p>
    </div>
  );
}

function MiniBreakdown({
  title,
  rows,
}: {
  title: string;
  rows: ReadonlyArray<readonly [string, number]>;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      <div className="mt-3 space-y-2">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="text-slate-600">{label}</span>
            <span className="font-semibold text-slate-950 tabular-nums">
              {formatCurrency(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompactMetric({
  label,
  helper,
  value,
}: {
  label: string;
  helper: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-900">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-950 tabular-nums">
        {formatCurrency(value)}
      </p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}
