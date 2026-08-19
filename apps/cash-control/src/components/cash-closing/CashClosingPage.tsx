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
  X,
} from "lucide-react";
import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { useBusinessFunds } from "@/components/business-funds/BusinessFundsContext";
import { useMockSession } from "@/components/session/MockSessionContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { buildCashClosingStory } from "@/lib/cashClosing";
import { formatCurrency } from "@/lib/formatters";
import type {
  BankClosingStory,
  CashClosingStatus,
  CashMovement,
  CashMovementCategory,
  FinancialTimeline,
  FinancialTimelineEvent,
  FinancialTimelineImpact,
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
    state.countedAvailableCash === ""
      ? NaN
      : Number(state.countedAvailableCash);
  const countedReservedNumeric =
    state.countedReservedCash === "" ? NaN : Number(state.countedReservedCash);
  const countedNumeric =
    Number.isNaN(countedAvailableNumeric) ||
    Number.isNaN(countedReservedNumeric)
      ? NaN
      : countedAvailableNumeric + countedReservedNumeric;
  const hasCountedValue =
    state.countedAvailableCash !== "" &&
    state.countedReservedCash !== "" &&
    !Number.isNaN(countedNumeric);
  const difference = hasCountedValue
    ? countedNumeric - story.expectedCash
    : NaN;
  const availableDifference =
    state.countedAvailableCash !== "" && !Number.isNaN(countedAvailableNumeric)
      ? countedAvailableNumeric - story.availableCash
      : NaN;
  const reservedDifference =
    state.countedReservedCash !== "" && !Number.isNaN(countedReservedNumeric)
      ? countedReservedNumeric - story.reservedCash.total
      : NaN;
  const bankDifferences = story.bankStories.map((bank) => {
    const countedValue = state.countedBanks[bank.bankId] ?? "";
    const counted = countedValue === "" ? NaN : Number(countedValue);
    return {
      bankId: bank.bankId,
      countedValue,
      counted,
      difference: Number.isNaN(counted) ? NaN : counted - bank.expectedBalance,
    };
  });
  const hasAllBankValues = bankDifferences.every(
    (bank) => bank.countedValue !== "" && !Number.isNaN(bank.counted),
  );
  const totalControlledDifference =
    (hasCountedValue ? difference : 0) +
    bankDifferences.reduce(
      (sum, bank) =>
        sum + (Number.isNaN(bank.difference) ? 0 : bank.difference),
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

  function _scrollToSection(ref: RefObject<HTMLDivElement | null>) {
    ref.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  function handleConfirm(observations: string) {
    if (!hasCountedValue || !hasAllBankValues) return;

    const hasAnyDifference =
      Math.round(availableDifference * 100) !== 0 ||
      Math.round(reservedDifference * 100) !== 0 ||
      bankDifferences.some((bank) => Math.round(bank.difference * 100) !== 0);
    const nextStatus = !hasAnyDifference
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

      <section className="space-y-4">
        <div ref={openingRef}>
          <FinancialTimelineCard timeline={story.timeline} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
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

function FinancialTimelineCard({ timeline }: { timeline: FinancialTimeline }) {
  const [selectedEvent, setSelectedEvent] =
    useState<FinancialTimelineEvent | null>(null);
  const visibleEvents = timeline.events.slice(0, 8);
  const hiddenCount = Math.max(
    0,
    timeline.events.length - visibleEvents.length,
  );

  return (
    <>
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-bold text-slate-950">
          Cómo llegamos a esta cantidad
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Reconstruimos el dinero paso a paso usando todos los movimientos
          registrados.
        </p>

        {timeline.reconstructionIssues.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {timeline.reconstructionIssues.map((issue) => (
              <p key={issue}>{issue}</p>
            ))}
          </div>
        )}

        <div className="mt-5 space-y-6">
          <TimelineStart timeline={timeline} />
          <section>
            <h4 className="text-sm font-bold uppercase tracking-wide text-slate-400">
              Lo que ocurrió
            </h4>
            <div className="relative mt-4 space-y-0 pl-6 before:absolute before:top-2 before:bottom-2 before:left-2 before:w-px before:bg-slate-200">
              {visibleEvents.map((event) => (
                <TimelineEventCard
                  key={event.id}
                  event={event}
                  onView={() => setSelectedEvent(event)}
                />
              ))}
            </div>
            {hiddenCount > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-semibold text-blue-700">
                  Ver {hiddenCount} movimientos más
                </summary>
                <div className="relative mt-4 space-y-0 pl-6 before:absolute before:top-2 before:bottom-2 before:left-2 before:w-px before:bg-slate-200">
                  {timeline.events.slice(visibleEvents.length).map((event) => (
                    <TimelineEventCard
                      key={event.id}
                      event={event}
                      onView={() => setSelectedEvent(event)}
                    />
                  ))}
                </div>
              </details>
            )}
          </section>
          <TimelineFinal timeline={timeline} />
        </div>
      </section>

      <TimelineEventDetailsModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </>
  );
}

function TimelineStart({ timeline }: { timeline: FinancialTimeline }) {
  return (
    <section className="rounded-xl bg-slate-50 p-4">
      <h4 className="text-sm font-bold uppercase tracking-wide text-slate-400">
        Al comenzar
      </h4>
      <div className="mt-4 grid gap-5 lg:grid-cols-[0.9fr_1.4fr]">
        <div>
          <p className="text-sm font-semibold text-slate-900">Efectivo</p>
          <p className="mt-2 text-2xl font-bold text-slate-950 tabular-nums">
            {formatCurrency(timeline.initialCash)}
          </p>
          <div className="mt-3 space-y-2 text-sm">
            <SplitRow
              label="Caja física"
              value={timeline.initialAvailableCash}
            />
            <SplitRow
              label="Caja de retiros apartados"
              value={timeline.initialReservedCash}
            />
            <SplitRow
              label="Total en efectivo"
              value={timeline.initialCash}
              strong
            />
          </div>
        </div>
        <div className="border-t border-slate-200 pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
          <p className="text-sm font-semibold text-slate-900">Bancos</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {timeline.initialBanks.map((bank) => (
              <SplitRow
                key={bank.bankId}
                label={bank.bankName}
                value={bank.initialBalance}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function TimelineEventCard({
  event,
  onView,
}: {
  event: FinancialTimelineEvent;
  onView: () => void;
}) {
  const amount = getTimelineEventMainAmount(event);
  const badge = getTimelineEventBadge(event);
  const reference = getTimelineEventReference(event);

  return (
    <article className="relative pb-6 last:pb-0">
      <span className="absolute -left-[1.15rem] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-200 ring-1 ring-emerald-100" />
      <div className="rounded-xl border-b border-slate-100 bg-white/70 px-3 py-3 transition hover:bg-slate-50/80 sm:px-4">
        <div className="grid gap-2 sm:grid-cols-[4.5rem_8rem_minmax(0,1fr)_8rem_5.25rem] sm:items-center">
          <div className="flex items-center justify-between gap-3 sm:block">
            <span className="text-sm font-bold text-slate-500 tabular-nums">
              {formatTimelineTime(event.occurredAt)}
            </span>
            <span className="sm:hidden">
              <TimelineBadge label={badge} />
            </span>
          </div>
          <div className="hidden sm:block">
            <TimelineBadge label={badge} />
          </div>
          <p className="min-w-0 truncate text-sm font-semibold text-slate-900">
            {reference}
          </p>
          <p className="row-start-3 text-sm font-bold text-slate-950 tabular-nums sm:row-auto sm:text-right">
            {amount}
          </p>
          <button
            type="button"
            title="Ver detalle del movimiento"
            aria-label={`Ver detalle del movimiento ${reference}`}
            onClick={onView}
            className="row-start-3 inline-flex h-10 min-w-10 cursor-pointer items-center justify-center gap-1.5 justify-self-end rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 sm:row-auto sm:h-9"
          >
            <Eye aria-hidden="true" className="h-4 w-4" />
            <span>VER</span>
          </button>
        </div>
      </div>
    </article>
  );
}

function TimelineBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex w-fit rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-500 ring-1 ring-slate-200">
      {label}
    </span>
  );
}

function TimelineEventDetailsModal({
  event,
  onClose,
}: {
  event: FinancialTimelineEvent | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!event) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(keyboardEvent: KeyboardEvent) {
      if (keyboardEvent.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [event, onClose]);

  if (!event) {
    return null;
  }

  const reference = getTimelineEventReference(event);
  const bank = getTimelineEventDetail(event, "Banco");
  const commission = getTimelineEventDetail(event, "Comisi");
  const reason = getTimelineEventDetail(event, "Motivo");
  const commissionLocation = getCommissionLocation(event.commissionInfo);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-3 sm:p-6">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        className="cc-modal-surface relative z-10 my-4 flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl shadow-xl animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="timeline-event-detail-title"
      >
        <div className="cc-modal-header flex shrink-0 items-center justify-between px-5 py-4">
          <div className="min-w-0 pr-4">
            <p className="cc-modal-description text-sm font-medium">
              {getTimelineEventBadge(event)}
            </p>
            <h2
              id="timeline-event-detail-title"
              className="cc-modal-title text-lg font-bold"
            >
              Detalle del movimiento
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <TimelineDetailItem
              label="Tipo"
              value={getTimelineEventBadge(event)}
            />
            <TimelineDetailItem
              label="Fecha"
              value={formatTimelineCalendarDate(event.occurredAt)}
            />
            <TimelineDetailItem
              label="Hora"
              value={formatTimelineTime(event.occurredAt)}
            />
            <TimelineDetailItem
              label="Monto"
              value={getTimelineEventMainAmount(event)}
            />
            <TimelineDetailItem label="Persona/referencia" value={reference} />
            {bank && <TimelineDetailItem label="Banco" value={bank} />}
            {commission && (
              <TimelineDetailItem label="Comision" value={commission} />
            )}
            {commissionLocation && (
              <TimelineDetailItem label="Quedo en" value={commissionLocation} />
            )}
            {reason && <TimelineDetailItem label="Motivo" value={reason} />}
            <TimelineDetailItem label="Registrado por" value={event.actor} />
          </div>

          {event.description && (
            <p className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {event.description}
            </p>
          )}

          <section className="mt-5">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-400">
              Impacto del movimiento
            </h3>
            <ImpactTable impacts={event.impacts} />
          </section>

          {(event.commissionInfo || event.note) && (
            <div className="mt-4 space-y-2 text-xs">
              {event.commissionInfo && (
                <p className="inline-flex rounded-lg border border-cyan-100 bg-cyan-50 px-3 py-2 text-cyan-800">
                  {event.commissionInfo}
                </p>
              )}
              {event.note && (
                <p className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-slate-500">
                  {event.note}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-200 px-5 py-4">
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineDetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <p className="text-xs font-medium uppercase text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-800">
        {value}
      </p>
    </div>
  );
}

function ImpactTable({ impacts }: { impacts: FinancialTimelineImpact[] }) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-slate-100">
      <div className="hidden grid-cols-[1.2fr_1fr_1fr_1fr] bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 sm:grid">
        <span>Recurso</span>
        <span className="text-right">Antes</span>
        <span className="text-right">Cambio</span>
        <span className="text-right">Después</span>
      </div>
      <div className="divide-y divide-slate-100">
        {impacts.map((impact) => (
          <ImpactRow key={impact.resourceId} impact={impact} />
        ))}
      </div>
    </div>
  );
}

function ImpactRow({ impact }: { impact: FinancialTimelineImpact }) {
  const isPositive = impact.amount > 0;
  const isNegative = impact.amount < 0;
  const valueClass = isPositive
    ? "text-emerald-700"
    : isNegative
      ? "text-orange-700"
      : "text-slate-500";

  return (
    <div className="grid gap-2 bg-white px-3 py-3 text-sm sm:grid-cols-[1.2fr_1fr_1fr_1fr] sm:items-center">
      <div>
        <p className="font-semibold text-slate-900">{impact.resourceName}</p>
        {impact.detail && (
          <p className="mt-1 text-xs text-slate-500">{impact.detail}</p>
        )}
      </div>
      <TimelineValue label="Antes" value={formatCurrency(impact.before)} />
      <TimelineValue
        label="Cambio"
        value={formatSignedCurrency(impact.amount)}
        className={valueClass}
      />
      <TimelineValue label="Después" value={formatCurrency(impact.after)} />
    </div>
  );
}

function TimelineValue({
  label,
  value,
  className = "text-slate-800",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
      <span className="text-xs text-slate-400 sm:hidden">{label}</span>
      <span className={`font-semibold tabular-nums ${className}`}>{value}</span>
    </div>
  );
}

function _LegacyTimelineEventCard({
  event,
}: {
  event: FinancialTimelineEvent;
}) {
  return (
    <article className="hidden rounded-xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-500 ring-1 ring-slate-200">
            {event.badge}
          </span>
          <h5 className="mt-2 text-base font-bold text-slate-950">
            {formatTimelineDate(event.occurredAt)} · {event.title}
          </h5>
          <p className="mt-1 text-sm text-slate-600">{event.description}</p>
          <p className="mt-1 text-xs text-slate-400">
            Registrado por: {event.actor}
          </p>
        </div>
        <div className="grid gap-2 text-xs text-slate-500 sm:grid-cols-2 lg:min-w-72">
          {event.details.map((detail) => (
            <div key={detail.label} className="rounded-lg bg-white px-3 py-2">
              <p className="font-medium text-slate-400">{detail.label}</p>
              <p className="mt-0.5 font-semibold text-slate-700">
                {detail.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {event.impacts.map((impact) => (
          <ImpactCard
            key={`${event.id}-${impact.resourceId}`}
            impact={impact}
          />
        ))}
      </div>

      {(event.commissionInfo || event.note) && (
        <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
          {event.commissionInfo && (
            <p className="rounded-lg border border-cyan-100 bg-cyan-50 px-3 py-2 text-cyan-800">
              {event.commissionInfo}
            </p>
          )}
          {event.note && (
            <p className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-slate-500">
              {event.note}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

function ImpactCard({ impact }: { impact: FinancialTimelineImpact }) {
  const isPositive = impact.amount > 0;
  const isNegative = impact.amount < 0;
  const valueClass = isPositive
    ? "text-emerald-700"
    : isNegative
      ? "text-orange-700"
      : "text-slate-500";

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-950">
          {impact.resourceName}
        </p>
        <span className="rounded-full bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-500">
          {impact.resourceType === "bank" ? "Banco" : "Caja"}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <TinyTimelineMetric
          label="Antes"
          value={formatCurrency(impact.before)}
        />
        <TinyTimelineMetric
          label="Movimiento"
          value={formatSignedCurrency(impact.amount)}
          className={valueClass}
        />
        <TinyTimelineMetric
          label="Después"
          value={formatCurrency(impact.after)}
        />
      </div>
      {impact.detail && (
        <p className="mt-3 text-xs text-slate-500">{impact.detail}</p>
      )}
    </div>
  );
}

function TimelineFinal({ timeline }: { timeline: FinancialTimeline }) {
  return (
    <section className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
      <h4 className="text-sm font-bold uppercase tracking-wide text-blue-700">
        Así quedó tu dinero
      </h4>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-blue-100 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Efectivo</p>
          <SplitRow label="Caja física" value={timeline.finalAvailableCash} />
          <SplitRow
            label="Caja de retiros apartados"
            value={timeline.finalReservedCash}
          />
          <SplitRow
            label="Total en efectivo"
            value={timeline.finalCash}
            strong
          />
        </div>
        <div className="rounded-xl border border-blue-100 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Bancos</p>
          <div className="mt-3 space-y-2">
            {timeline.finalBanks.map((bank) => (
              <SplitRow
                key={bank.bankId}
                label={bank.bankName}
                value={bank.finalBalance}
              />
            ))}
            <div className="border-t border-slate-100 pt-2">
              <SplitRow
                label="Total bancos"
                value={timeline.totalBanks}
                strong
              />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-blue-100 bg-white p-4">
        <p className="text-sm font-bold text-slate-950">Total controlado</p>
        <SplitRow label="Caja física" value={timeline.finalAvailableCash} />
        <SplitRow
          label="Caja de retiros apartados"
          value={timeline.finalReservedCash}
        />
        <SplitRow label="Total bancos" value={timeline.totalBanks} />
        <div className="mt-2 border-t border-slate-100 pt-2">
          <SplitRow label="Total" value={timeline.totalControlled} strong />
        </div>
      </div>
    </section>
  );
}

function _CashStoryCard({
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

function SplitRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-600">{label}</span>
      <span
        className={`tabular-nums ${
          strong ? "font-bold text-slate-950" : "font-semibold text-slate-800"
        }`}
      >
        {formatCurrency(value)}
      </span>
    </div>
  );
}

function TinyTimelineMetric({
  label,
  value,
  className = "text-slate-900",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`mt-1 text-xs font-semibold tabular-nums ${className}`}>
        {value}
      </p>
    </div>
  );
}

function getTimelineEventBadge(event: FinancialTimelineEvent): string {
  if (event.type === "business_fund_income") return "FONDOS · INGRESO";
  if (event.type === "business_fund_withdrawal") return "FONDOS · EGRESO";
  if (event.type === "reserved_cash_allocation") return "RETIRO";
  return event.badge;
}

function getTimelineEventReference(event: FinancialTimelineEvent): string {
  if (event.type === "business_fund_income") {
    return `Ingreso a ${formatTimelineResourceReference(event.description)}`;
  }

  if (event.type === "business_fund_withdrawal") {
    return `Retiro de ${formatTimelineResourceReference(event.description)}`;
  }

  return event.description || event.title;
}

function formatTimelineResourceReference(resourceName: string): string {
  if (resourceName.toLowerCase().includes("caja")) {
    return "Caja";
  }

  return resourceName;
}

function getTimelineEventMainAmount(event: FinancialTimelineEvent): string {
  const amountDetail =
    event.details.find((detail) =>
      detail.label.toLowerCase().includes("monto"),
    ) ?? event.details[0];

  if (amountDetail?.value) {
    return amountDetail.value;
  }

  const largestImpact = event.impacts.reduce<FinancialTimelineImpact | null>(
    (currentLargest, impact) =>
      !currentLargest ||
      Math.abs(impact.amount) > Math.abs(currentLargest.amount)
        ? impact
        : currentLargest,
    null,
  );

  return largestImpact ? formatCurrency(Math.abs(largestImpact.amount)) : "-";
}

function getTimelineEventDetail(
  event: FinancialTimelineEvent,
  labelFragment: string,
): string | null {
  const normalizedFragment = labelFragment.toLowerCase();
  return (
    event.details.find((detail) =>
      detail.label.toLowerCase().includes(normalizedFragment),
    )?.value ?? null
  );
}

function getCommissionLocation(commissionInfo?: string): string | null {
  if (!commissionInfo) return null;

  const locationMatch = commissionInfo.match(/qued\S* en (.+?)\.?$/i);
  return locationMatch?.[1] ?? null;
}

function formatTimelineCalendarDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatTimelineTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatSignedCurrency(value: number): string {
  if (Number.isNaN(value)) return "—";
  return value > 0 ? `+${formatCurrency(value)}` : formatCurrency(value);
}

function formatTimelineDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
