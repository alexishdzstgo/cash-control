"use client";

import {
  ArrowDown,
  ArrowUp,
  Banknote,
  ChevronRight,
  ClipboardList,
  Eye,
  PiggyBank,
  Wallet,
} from "lucide-react";
import { type RefObject, useMemo, useRef, useState } from "react";
import { useBusinessFunds } from "@/components/business-funds/BusinessFundsContext";
import { useMockSession } from "@/components/session/MockSessionContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { buildCashClosingStory } from "@/lib/cashClosing";
import { formatCurrency } from "@/lib/formatters";
import type {
  CashClosingStatus,
  BankClosingStory,
  CashMovement,
  CashMovementCategory,
} from "@/types/cash-closing";
import { CashClosingConfirmation } from "./CashClosingConfirmation";
import { CashClosingResult } from "./CashClosingResult";
import { CashMovementBreakdown } from "./CashMovementBreakdown";
import { mockCashClosingData } from "./cashClosingMockData";
import { MovementDetailsModal } from "./MovementDetailsModal";
import { ShiftClosingHeader } from "./ShiftClosingHeader";

type CashClosingPageState = {
  status: CashClosingStatus;
  isCounting: boolean;
  isDone: boolean;
  countedCash: string;
  countedAvailableCash: string;
  countedReservedCash: string;
  countedBanks: Record<string, string>;
  observations: string;
  activeDetail: {
    category: CashMovementCategory;
    movements: CashMovement[];
  } | null;
};

const INITIAL_STATE: CashClosingPageState = {
  status: "pending",
  isCounting: false,
  isDone: false,
  countedCash: "",
  countedAvailableCash: "",
  countedReservedCash: "",
  countedBanks: {},
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
  const { authenticatedUser } = useMockSession();
  const [state, setState] = useState<CashClosingPageState>(INITIAL_STATE);
  const storyRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLDivElement>(null);
  const openingRef = useRef<HTMLDivElement>(null);
  const entriesRef = useRef<HTMLDivElement>(null);
  const outputsRef = useRef<HTMLDivElement>(null);
  const isOwner = authenticatedUser?.systemRole === "owner";

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

  const countedAvailableNumeric =
    state.countedAvailableCash === "" ? NaN : Number(state.countedAvailableCash);
  const countedReservedNumeric =
    state.countedReservedCash === "" ? NaN : Number(state.countedReservedCash);
  const countedNumeric =
    Number.isNaN(countedAvailableNumeric) || Number.isNaN(countedReservedNumeric)
      ? NaN
      : countedAvailableNumeric + countedReservedNumeric;
  const hasCountedValue =
    state.countedAvailableCash !== "" &&
    state.countedReservedCash !== "" &&
    !Number.isNaN(countedNumeric);
  const difference = hasCountedValue
    ? countedNumeric - story.expectedCash
    : NaN;
  const bankDifferences = story.bankStories.map((bank) => {
    const countedValue = state.countedBanks[bank.bankId] ?? "";
    const counted = countedValue === "" ? NaN : Number(countedValue);
    return {
      bankId: bank.bankId,
      countedValue,
      counted,
      difference: Number.isNaN(counted)
        ? NaN
        : counted - bank.expectedBalance,
    };
  });
  const hasAllBankValues = bankDifferences.every(
    (bank) => bank.countedValue !== "" && !Number.isNaN(bank.counted),
  );
  const totalControlledDifference =
    (hasCountedValue ? difference : 0) +
    bankDifferences.reduce(
      (sum, bank) => sum + (Number.isNaN(bank.difference) ? 0 : bank.difference),
      0,
    );

  function handleStartCount() {
    setState((current) => ({
      ...current,
      isCounting: true,
      status: "in_progress",
    }));

    window.setTimeout(() => {
      countRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  function handleBackToReview() {
    storyRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function scrollToSection(ref: RefObject<HTMLDivElement | null>) {
    ref.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  function handleConfirm(observations: string) {
    if (!hasCountedValue || !hasAllBankValues) return;

    const hasAnyDifference =
      Math.round(difference * 100) !== 0 ||
      bankDifferences.some((bank) => Math.round(bank.difference * 100) !== 0);
    const nextStatus =
      !hasAnyDifference
        ? "balanced"
        : totalControlledDifference < 0
          ? "shortage"
          : "surplus";

    setState((current) => ({
      ...current,
      isDone: true,
      status: nextStatus,
      countedCash: countedNumeric.toFixed(2),
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

  if (state.isDone) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Corte de caja"
          description="Resumen final del corte cerrado en esta demostración mock."
        />
        <CashClosingResult
          status={state.status}
          countedCash={state.countedCash}
          expectedCash={story.expectedCash}
          difference={difference}
          shiftName="Corte actual"
          responsibleName={mockCashClosingData.shift.responsibleName}
          observations={state.observations}
          onReset={handleReset}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6" ref={storyRef}>
      <PageHeader
        title="Corte de caja"
        description="Entiende de dónde salió cada peso antes de cerrar el corte."
      />

      <ShiftClosingHeader shift={mockCashClosingData.shift} />

      <TurnStoryHero expectedCash={story.expectedCash} />

      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div ref={openingRef}>
          <CashStoryCard
            openingBalance={story.openingBalance}
            totalEntries={story.totalEntries}
            totalOutputs={story.totalOutputs}
            expectedCash={story.expectedCash}
            onViewOpening={() => scrollToSection(openingRef)}
            onViewEntries={() => scrollToSection(entriesRef)}
            onViewOutputs={() => scrollToSection(outputsRef)}
          />
        </div>
        <ReservedCashCard
          reservedCash={story.reservedCash.total}
          availableCash={story.availableCash}
          movements={story.reservedCash.movements}
          onViewReserved={handleViewReserved}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div ref={entriesRef}>
          <CashMovementBreakdown
            title="Ingresos"
            totalLabel="Total de ingresos"
            total={story.totalEntries}
            movements={story.allMovements.filter(
              (movement) => movement.direction === "in",
            )}
            emptyMessage="No hay entradas de efectivo registradas en este corte."
            onViewCategory={handleViewCategory}
          />
        </div>
        <div ref={outputsRef}>
          <CashMovementBreakdown
            title="Egresos"
            totalLabel="Total de egresos"
            total={story.totalOutputs}
            movements={story.allMovements.filter(
              (movement) => movement.direction === "out",
            )}
            emptyMessage="No hay salidas de efectivo registradas en este corte."
            onViewCategory={handleViewCategory}
          />
        </div>
      </section>

      <BankStoriesSection bankStories={story.bankStories} />

      <CommissionProfitCard
        isOwner={isOwner}
        total={story.commissionProfit.totalCommissionProfit}
        depositTotal={story.commissionProfit.depositCommissionProfit}
        withdrawalTotal={story.commissionProfit.withdrawalCommissionProfit}
        cashTotal={story.commissionProfit.cashCommissionProfit}
        bankTotal={story.commissionProfit.bankCommissionProfit}
        bankBreakdown={story.commissionProfit.bankBreakdown}
      />

      {!state.isCounting ? (
        <ReadyToCountCard onStartCount={handleStartCount} />
      ) : (
        <section ref={countRef} className="space-y-6 scroll-mt-6">
          <CashClosingConfirmation
            countedCash={state.countedCash}
            countedAvailableCash={state.countedAvailableCash}
            countedReservedCash={state.countedReservedCash}
            countedBanks={state.countedBanks}
            expectedCash={story.expectedCash}
            commissionProfit={story.commissionProfit}
            reservedCash={story.reservedCash.total}
            availableCash={story.availableCash}
            bankStories={story.bankStories}
            isOwner={isOwner}
            difference={difference}
            observations={state.observations}
            onCountedAvailableCashChange={(countedAvailableCash) =>
              setState((current) => ({ ...current, countedAvailableCash }))
            }
            onCountedReservedCashChange={(countedReservedCash) =>
              setState((current) => ({ ...current, countedReservedCash }))
            }
            onCountedBankChange={(bankId, value) =>
              setState((current) => ({
                ...current,
                countedBanks: { ...current.countedBanks, [bankId]: value },
              }))
            }
            onObservationsChange={(observations) =>
              setState((current) => ({ ...current, observations }))
            }
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
  onViewOpening,
  onViewEntries,
  onViewOutputs,
}: {
  openingBalance: number;
  totalEntries: number;
  totalOutputs: number;
  expectedCash: number;
  onViewOpening: () => void;
  onViewEntries: () => void;
  onViewOutputs: () => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-bold text-slate-950">
        Cómo llegamos a esta cantidad
      </h3>
      <p className="mt-1 text-sm text-slate-500">
        La fórmula reconstruye el efectivo esperado desde la historia real del
        corte.
      </p>

      <div className="mt-5 space-y-3">
        <StoryLine
          icon={Wallet}
          label="Caja al iniciar"
          helper="Lo que había al comenzar el corte."
          value={openingBalance}
          tone="neutral"
          onClick={onViewOpening}
        />
        <StoryLine
          icon={ArrowUp}
          label="Ingresos"
          helper="Dinero que aumentó este recurso."
          value={totalEntries}
          tone="in"
          sign="+"
          onClick={onViewEntries}
        />
        <StoryLine
          icon={ArrowDown}
          label="Egresos"
          helper="Dinero que disminuyó este recurso."
          value={totalOutputs}
          tone="out"
          sign="-"
          onClick={onViewOutputs}
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
  isOwner,
  total,
  depositTotal,
  withdrawalTotal,
  cashTotal,
  bankTotal,
  bankBreakdown,
}: {
  isOwner: boolean;
  total: number;
  depositTotal: number;
  withdrawalTotal: number;
  cashTotal: number;
  bankTotal: number;
  bankBreakdown: Array<{ id: string; label: string; amount: number }>;
}) {
  const title = isOwner ? "Ganancias por comisiones" : "Comisiones del corte";

  return (
    <section className="rounded-2xl border border-cyan-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-950">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {isOwner
              ? "Comisiones generadas durante el periodo que estás cerrando y dónde quedó ese dinero."
              : "Esto forma parte de cómo se movió el dinero durante el corte."}
          </p>
        </div>
        <p className="text-3xl font-bold text-cyan-700 tabular-nums">
          {formatCurrency(total)}
        </p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {isOwner && (
          <MiniBreakdown
            title="De dónde salió"
            rows={[
              ["Depósitos", depositTotal],
              ["Retiros", withdrawalTotal],
            ]}
          />
        )}
        <MiniBreakdown
          title="Dónde quedó"
          rows={[
            ["Caja física", cashTotal],
            ["Bancos", bankTotal],
            ...(isOwner
              ? bankBreakdown.map((bank) => [bank.label, bank.amount] as const)
              : []),
          ]}
        />
      </div>
    </section>
  );
}

function BankStoriesSection({
  bankStories,
}: {
  bankStories: BankClosingStory[];
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h3 className="text-lg font-bold text-slate-950">Bancos</h3>
        <p className="mt-1 text-sm text-slate-500">
          Revisa cómo cambiaron los saldos de cada banco según los movimientos
          registrados.
        </p>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        {bankStories.map((bank) => (
          <BankStoryCard key={bank.bankId} bank={bank} />
        ))}
      </div>
    </section>
  );
}

function BankStoryCard({ bank }: { bank: BankClosingStory }) {
  return (
    <article className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <h4 className="text-sm font-bold text-slate-950">{bank.bankName}</h4>
      <p className="mt-1 text-xs text-slate-500">{bank.accountName}</p>

      <div className="mt-4 space-y-3">
        <BankFormulaLine
          label="Saldo al iniciar"
          value={bank.openingBalance}
          tone="neutral"
        />
        <BankFormulaLine
          label="Ingresos"
          value={bank.totalEntries}
          tone="in"
          sign="+"
          count={bank.entries.length}
          movements={bank.entries}
        />
        <BankFormulaLine
          label="Egresos"
          value={bank.totalOutputs}
          tone="out"
          sign="-"
          count={bank.outputs.length}
          movements={bank.outputs}
        />
        <div className="border-t border-slate-200 pt-3">
          <BankFormulaLine
            label="Saldo esperado"
            value={bank.expectedBalance}
            tone="strong"
            sign="="
          />
        </div>
      </div>
    </article>
  );
}

function BankFormulaLine({
  label,
  value,
  tone,
  sign = "",
  count,
  movements,
}: {
  label: string;
  value: number;
  tone: "neutral" | "in" | "out" | "strong";
  sign?: string;
  count?: number;
  movements?: BankClosingStory["entries"];
}) {
  const toneClass = {
    neutral: "text-slate-700",
    in: "text-emerald-700",
    out: "text-orange-700",
    strong: "text-blue-700",
  }[tone];

  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 rounded-lg py-1 transition hover:bg-white/70">
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${toneClass}`}>
            {sign && <span className="mr-2">{sign}</span>}
            {label}
          </p>
          {count !== undefined && (
            <p className="mt-0.5 text-xs text-slate-400">
              {count} {count === 1 ? "movimiento" : "movimientos"}
            </p>
          )}
        </div>
        <span className={`text-sm font-bold tabular-nums ${toneClass}`}>
          {formatCurrency(value)}
        </span>
      </summary>

      {movements && movements.length > 0 && (
        <div className="mt-2 space-y-2 border-l border-slate-200 pl-3">
          {movements.map((movement) => (
            <div key={movement.id} className="text-xs text-slate-500">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">{movement.description}</span>
                <span className="font-semibold tabular-nums text-slate-700">
                  {formatCurrency(movement.amount)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </details>
  );
}

function ReadyToCountCard({ onStartCount }: { onStartCount: () => void }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-950">
            ¿Listo para hacer el conteo?
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Revisa la información anterior y, cuando todo tenga sentido, cuenta
            el efectivo físico que tienes en caja.
          </p>
        </div>
        <button type="button" onClick={onStartCount} className="btn-primary">
          <ClipboardList className="h-4 w-4" />
          Iniciar corte de caja
        </button>
      </div>
    </section>
  );
}

function StoryLine({
  icon: Icon,
  label,
  helper,
  value,
  tone,
  sign = "",
  onClick,
}: {
  icon: typeof Wallet;
  label: string;
  helper: string;
  value: number;
  tone: "neutral" | "in" | "out" | "reserved" | "strong";
  sign?: string;
  onClick?: () => void;
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

  const content = (
    <>
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
      {onClick && <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-left transition hover:border-slate-200 hover:bg-slate-100/70"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
      {content}
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
