"use client";

import { AlertTriangle, CheckCircle2, DollarSign, TrendingUp } from "lucide-react";
import type { ChangeEvent } from "react";
import { useId, useState } from "react";
import { formatCurrency } from "@/lib/formatters";
import type {
  BankClosingStory,
  ShiftCommissionProfitSummary,
} from "@/types/cash-closing";

type CashClosingConfirmationProps = {
  countedCash: string;
  countedAvailableCash: string;
  countedReservedCash: string;
  countedBanks: Record<string, string>;
  expectedCash: number;
  commissionProfit: ShiftCommissionProfitSummary;
  reservedCash: number;
  availableCash: number;
  bankStories: BankClosingStory[];
  isOwner: boolean;
  difference: number;
  observations: string;
  onCountedAvailableCashChange: (value: string) => void;
  onCountedReservedCashChange: (value: string) => void;
  onCountedBankChange: (bankId: string, value: string) => void;
  onObservationsChange: (value: string) => void;
  onBack: () => void;
  onConfirm: (observations: string) => void;
};

type ConfirmDialogState = "idle" | "confirming";

export function CashClosingConfirmation({
  countedAvailableCash,
  countedReservedCash,
  countedBanks,
  expectedCash,
  commissionProfit,
  reservedCash,
  availableCash,
  bankStories,
  isOwner,
  difference,
  observations,
  onCountedAvailableCashChange,
  onCountedReservedCashChange,
  onCountedBankChange,
  onObservationsChange,
  onBack,
  onConfirm,
}: CashClosingConfirmationProps) {
  const observationsId = useId();
  const [dialogState, setDialogState] = useState<ConfirmDialogState>("idle");
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false);

  const countedAvailable = parseMoney(countedAvailableCash);
  const countedReserved = parseMoney(countedReservedCash);
  const hasAvailableValue =
    countedAvailableCash !== "" && !Number.isNaN(countedAvailable);
  const hasReservedValue =
    countedReservedCash !== "" && !Number.isNaN(countedReserved);
  const hasPhysicalValues =
    hasAvailableValue && hasReservedValue;
  const countedPhysical = hasPhysicalValues
    ? countedAvailable + countedReserved
    : NaN;
  const availableDifference = hasAvailableValue
    ? countedAvailable - availableCash
    : NaN;
  const reservedDifference = hasReservedValue
    ? countedReserved - reservedCash
    : NaN;
  const cashDifference = hasPhysicalValues ? countedPhysical - expectedCash : NaN;
  const availableResult = getResultConfig(
    hasAvailableValue ? Math.round(availableDifference * 100) : NaN,
    "Caja física",
  );
  const reservedResult = getResultConfig(
    hasReservedValue ? Math.round(reservedDifference * 100) : NaN,
    "Caja de retiros apartados",
  );
  const cashResult = getResultConfig(
    hasPhysicalValues ? Math.round(cashDifference * 100) : NaN,
    "Total en efectivo",
  );

  const bankComparisons = bankStories.map((bank) => {
    const value = countedBanks[bank.bankId] ?? "";
    const counted = parseMoney(value);
    const hasValue = value !== "" && !Number.isNaN(counted);
    const bankDifference = hasValue ? counted - bank.expectedBalance : NaN;
    return {
      ...bank,
      countedValue: value,
      counted,
      hasValue,
      difference: bankDifference,
      result: getResultConfig(
        hasValue ? Math.round(bankDifference * 100) : NaN,
        bank.bankName,
      ),
    };
  });

  const hasAllBankValues = bankComparisons.every((bank) => bank.hasValue);
  const totalBanksExpected = bankStories.reduce(
    (sum, bank) => sum + bank.expectedBalance,
    0,
  );
  const totalBanksCounted = bankComparisons.reduce(
    (sum, bank) => sum + (bank.hasValue ? bank.counted : 0),
    0,
  );
  const totalBanksDifference = bankComparisons.reduce(
    (sum, bank) => sum + (bank.hasValue ? bank.difference : 0),
    0,
  );
  const hasAnyDifference =
    (hasAvailableValue && Math.round(availableDifference * 100) !== 0) ||
    (hasReservedValue && Math.round(reservedDifference * 100) !== 0) ||
    bankComparisons.some(
      (bank) => bank.hasValue && Math.round(bank.difference * 100) !== 0,
    );
  const totalControlledDifference =
    (hasPhysicalValues ? cashDifference : 0) + totalBanksDifference;
  const generalResult = getResultConfig(
    hasPhysicalValues && hasAllBankValues
      ? Math.round(totalControlledDifference * 100)
      : NaN,
    "Resultado",
  );
  const isObservationMissing = hasAnyDifference && observations.trim() === "";
  const showObservationError = hasTriedSubmit && isObservationMissing;
  const canAttemptConfirm = hasPhysicalValues && hasAllBankValues;
  const commissionTitle = isOwner
    ? "Ganancias por comisiones"
    : "Comisiones del corte";

  function handleStartConfirm() {
    setHasTriedSubmit(true);

    if (!canAttemptConfirm || isObservationMissing) return;

    setDialogState("confirming");
  }

  function handleConfirm() {
    onConfirm(observations.trim());
    setDialogState("idle");
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-950">Corte de caja</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Cuenta el efectivo físico disponible, el dinero apartado y consulta
            los saldos actuales de bancos.
          </p>
        </div>
        <StatusPill result={generalResult} />
      </div>

      <div className="mt-5 space-y-5">
        <section className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <h3 className="text-sm font-bold text-slate-950">Efectivo</h3>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <MoneyInput
              label="¿Cuánto efectivo disponible contaste?"
              value={countedAvailableCash}
              onChange={onCountedAvailableCashChange}
            />
            <MoneyInput
              label="¿Cuánto efectivo tienes apartado para retiros pendientes?"
              value={countedReservedCash}
              onChange={onCountedReservedCashChange}
            />
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <Metric
              label="Caja física"
              value={
                hasAvailableValue
                  ? formatSignedCurrency(availableDifference)
                  : "Sin conteo"
              }
              helper={`Esperado: ${formatCurrency(availableCash)} · Contado: ${
                hasAvailableValue ? formatCurrency(countedAvailable) : "sin conteo"
              }`}
              valueClassName={availableResult.valueClassName}
            />
            <Metric
              label="Caja de retiros apartados"
              value={
                hasReservedValue
                  ? formatSignedCurrency(reservedDifference)
                  : "Sin conteo"
              }
              helper={`Esperado: ${formatCurrency(reservedCash)} · Contado: ${
                hasReservedValue ? formatCurrency(countedReserved) : "sin conteo"
              }`}
              valueClassName={reservedResult.valueClassName}
            />
            <Metric
              label="Total en efectivo"
              value={
                hasPhysicalValues
                  ? formatSignedCurrency(cashDifference)
                  : "Sin conteo"
              }
              helper={`Esperado: ${formatCurrency(expectedCash)} · Contado: ${
                hasPhysicalValues ? formatCurrency(countedPhysical) : "sin conteo"
              }`}
              valueClassName={cashResult.valueClassName}
            />
          </div>
        </section>
        <section className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <h3 className="text-sm font-bold text-slate-950">Bancos</h3>
          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            {bankComparisons.map((bank) => (
              <BankCountCard
                key={bank.bankId}
                bank={bank}
                onChange={(value) => onCountedBankChange(bank.bankId, value)}
              />
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-100 bg-white p-4">
          <h3 className="text-sm font-bold text-slate-950">
            Resultado del corte
          </h3>
          <div className="mt-3 space-y-2">
            <ResultLine label="Caja física" result={availableResult} />
            <ResultLine
              label="Caja de retiros apartados"
              result={reservedResult}
            />
            <ResultLine label="Total en efectivo" result={cashResult} />
            {bankComparisons.map((bank) => (
              <ResultLine
                key={bank.bankId}
                label={bank.bankName}
                result={bank.result}
              />
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <span className="text-sm font-semibold text-slate-900">
              Total en efectivo
            </span>
            <span
              className={`text-sm font-bold tabular-nums ${cashResult.valueClassName}`}
            >
              {hasPhysicalValues ? formatSignedCurrency(cashDifference) : "Sin conteo"}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-slate-900">
              Total bancos
            </span>
            <span
              className={`text-sm font-bold tabular-nums ${
                getResultConfig(
                  hasAllBankValues ? Math.round(totalBanksDifference * 100) : NaN,
                  "Bancos",
                ).valueClassName
              }`}
            >
              {hasAllBankValues
                ? formatSignedCurrency(totalBanksDifference)
                : "Sin conteo"}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-slate-900">
              Diferencia total controlada
            </span>
            <span
              className={`text-sm font-bold tabular-nums ${generalResult.valueClassName}`}
            >
              {canAttemptConfirm
                ? formatSignedCurrency(totalControlledDifference)
                : "Sin conteo"}
            </span>
          </div>
        </section>
      </div>

      <div className="mt-4">
        <label
          htmlFor={observationsId}
          className="block text-sm font-medium text-slate-700"
        >
          Observaciones
        </label>
        <textarea
          id={observationsId}
          value={observations}
          onChange={(event) => onObservationsChange(event.target.value)}
          placeholder="Agrega una explicación si existe una diferencia."
          rows={4}
          className={`mt-1 w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition ${
            showObservationError
              ? "border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500"
              : "border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          }`}
        />
        {showObservationError ? (
          <p className="mt-1 text-xs text-red-600">
            Agrega una explicación antes de cerrar el corte.
          </p>
        ) : hasAnyDifference ? (
          <p className="mt-1 text-xs text-slate-500">
            Agrega una explicación antes de cerrar el corte.
          </p>
        ) : (
          <p className="mt-1 text-xs text-slate-500">
            Las observaciones son opcionales cuando todos los recursos cuadran.
          </p>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onBack} className="btn-secondary">
          Volver a revisar
        </button>
        <button
          type="button"
          onClick={handleStartConfirm}
          disabled={!canAttemptConfirm}
          className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          Confirmar cierre
        </button>
      </div>

      {dialogState === "confirming" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3 sm:p-6">
          <div
            className="flex max-h-[90dvh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl animate-in fade-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-lg font-bold text-slate-900">
                Confirmar cierre de caja
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Revisa por última vez los datos antes de cerrar el corte.
              </p>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
              <div
                className={`rounded-xl p-4 ${generalResult.stateBlockClassName}`}
              >
                <StatusPill result={generalResult} />
                <p className="mt-2 text-sm">
                  Diferencia total:{" "}
                  <span className="font-semibold tabular-nums">
                    {formatSignedCurrency(totalControlledDifference)}
                  </span>
                </p>
              </div>

              <ModalResourceSummary
                title="Caja física"
                rows={[
                  ["Esperado", availableCash],
                  ["Contado", countedAvailable],
                  ["Diferencia", availableDifference],
                ]}
                differenceIndex={2}
                differenceClassName={availableResult.valueClassName}
              />

              <ModalResourceSummary
                title="Caja de retiros apartados"
                rows={[
                  ["Esperado", reservedCash],
                  ["Contado", countedReserved],
                  ["Diferencia", reservedDifference],
                ]}
                differenceIndex={2}
                differenceClassName={reservedResult.valueClassName}
              />

              <ModalResourceSummary
                title="Total en efectivo"
                rows={[
                  ["Esperado", expectedCash],
                  ["Contado", countedPhysical],
                  ["Diferencia", cashDifference],
                ]}
                differenceIndex={2}
                differenceClassName={cashResult.valueClassName}
              />

              {bankComparisons.map((bank) => (
                <ModalResourceSummary
                  key={bank.bankId}
                  title={bank.bankName}
                  rows={[
                    ["Esperado", bank.expectedBalance],
                    ["Capturado", bank.counted],
                    ["Diferencia", bank.difference],
                  ]}
                  differenceIndex={2}
                  differenceClassName={bank.result.valueClassName}
                />
              ))}

              <ModalResourceSummary
                title="Totales controlados"
                rows={[
                  ["Total efectivo esperado", expectedCash],
                  ["Total efectivo contado", countedPhysical],
                  ["Total bancos esperado", totalBanksExpected],
                  ["Total bancos capturado", totalBanksCounted],
                  ["Diferencia total controlada", totalControlledDifference],
                ]}
                differenceIndex={4}
                differenceClassName={generalResult.valueClassName}
              />

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {commissionTitle}
                </p>
                <p className="mt-2 text-lg font-bold text-slate-950 tabular-nums">
                  {formatCurrency(commissionProfit.totalCommissionProfit)}
                </p>
                <div className="mt-3 space-y-1 text-xs text-slate-500">
                  <div className="flex items-center justify-between gap-2">
                    <span>Caja física</span>
                    <span className="font-semibold tabular-nums text-slate-700">
                      {formatCurrency(commissionProfit.cashCommissionProfit)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span>Bancos</span>
                    <span className="font-semibold tabular-nums text-slate-700">
                      {formatCurrency(commissionProfit.bankCommissionProfit)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <p className="text-sm font-medium text-slate-700">
                  Observaciones
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {observations.trim() || "Sin observaciones."}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDialogState("idle")}
                className="btn-secondary"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="btn-primary"
              >
                Cerrar corte
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function MoneyInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const numericValue = value === "" ? NaN : Number(value);
  const hasInvalidValue = value !== "" && Number.isNaN(numericValue);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(sanitizeMoneyInput(event.target.value));
  }

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative mt-1">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-slate-500">
          $
        </span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={handleChange}
          placeholder="0.00"
          className={`w-full rounded-xl border bg-white py-2.5 pr-4 pl-9 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition ${
            hasInvalidValue
              ? "border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500"
              : "border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          }`}
        />
      </div>
      {hasInvalidValue && (
        <p className="mt-1 text-xs text-red-600">Ingresa un monto válido.</p>
      )}
    </div>
  );
}

function BankCountCard({
  bank,
  onChange,
}: {
  bank: BankClosingStory & {
    countedValue: string;
    counted: number;
    hasValue: boolean;
    difference: number;
    result: ResultConfig;
  };
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4">
      <MoneyInput
        label={`¿Qué saldo ves actualmente en ${bank.bankName}?`}
        value={bank.countedValue}
        onChange={onChange}
      />
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <TinyMetric label="Esperado" value={formatCurrency(bank.expectedBalance)} />
        <TinyMetric
          label="Capturado"
          value={bank.hasValue ? formatCurrency(bank.counted) : "Sin saldo"}
        />
        <TinyMetric
          label="Diferencia"
          value={bank.hasValue ? formatSignedCurrency(bank.difference) : "—"}
          className={bank.result.valueClassName}
        />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  helper,
  valueClassName = "text-slate-950",
}: {
  label: string;
  value: string;
  helper: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-2 text-xl font-bold tabular-nums ${valueClassName}`}>
        {value}
      </p>
      <p className="mt-2 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

function TinyMetric({
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

function ResultLine({ label, result }: { label: string; result: ResultConfig }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
      <span className="text-sm text-slate-700">{label}</span>
      <StatusPill result={result} />
    </div>
  );
}

function StatusPill({ result }: { result: ResultConfig }) {
  const Icon = result.icon;
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${result.badgeClassName}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {result.title}
    </span>
  );
}

function ModalResourceSummary({
  title,
  rows,
  differenceIndex,
  differenceClassName = "text-slate-950",
}: {
  title: string;
  rows: Array<readonly [string, number]>;
  differenceIndex?: number;
  differenceClassName?: string;
}) {
  return (
    <section className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <h3 className="text-sm font-bold text-slate-950">{title}</h3>
      <div className="mt-3 space-y-2">
        {rows.map(([label, value], index) => (
          <div
            key={label}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="text-slate-600">{label}</span>
            <span
              className={`font-semibold tabular-nums ${
                index === differenceIndex
                  ? differenceClassName
                  : "text-slate-950"
              }`}
            >
              {index === differenceIndex
                ? formatSignedCurrency(value)
                : formatCurrency(value)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function parseMoney(value: string): number {
  return value === "" ? NaN : Number(value);
}

function sanitizeMoneyInput(rawValue: string): string {
  if (rawValue === "") return "";

  const sanitized = rawValue.replace(/[^0-9.]/g, "");
  const parts = sanitized.split(".");

  if (parts.length > 2) return parts.slice(0, 2).join(".");
  if (parts[1] && parts[1].length > 2) {
    return `${parts[0]}.${parts[1].slice(0, 2)}`;
  }

  return sanitized;
}

function formatSignedCurrency(value: number): string {
  if (Number.isNaN(value)) return "—";
  return value > 0 ? `+${formatCurrency(value)}` : formatCurrency(value);
}

type ResultConfig = ReturnType<typeof getResultConfig>;

function getResultConfig(differenceCents: number, resourceName: string) {
  if (Number.isNaN(differenceCents)) {
    return {
      title: "Por contar",
      description: `Captura ${resourceName} para calcular la diferencia.`,
      icon: TrendingUp,
      badgeClassName: "bg-slate-100 text-slate-600",
      stateBlockClassName: "bg-slate-50 text-slate-700",
      valueClassName: "text-slate-600",
    };
  }

  if (differenceCents === 0) {
    return {
      title: "Correcto",
      description: "Coincide con lo registrado por el sistema.",
      icon: CheckCircle2,
      badgeClassName: "bg-emerald-50 text-emerald-700",
      stateBlockClassName: "bg-emerald-50 text-emerald-700",
      valueClassName: "text-emerald-700",
    };
  }

  if (differenceCents < 0) {
    return {
      title: "Faltante",
      description: "Hay menos de lo esperado.",
      icon: AlertTriangle,
      badgeClassName: "bg-red-50 text-red-700",
      stateBlockClassName: "bg-red-50 text-red-700",
      valueClassName: "text-red-700",
    };
  }

  return {
    title: "Sobrante",
    description: "Hay más de lo esperado.",
    icon: TrendingUp,
    badgeClassName: "bg-blue-50 text-blue-700",
    stateBlockClassName: "bg-blue-50 text-blue-700",
    valueClassName: "text-blue-700",
  };
}
