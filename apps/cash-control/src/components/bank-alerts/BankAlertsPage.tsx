"use client";

import {
  AlertCircle,
  AlertOctagon,
  ArrowRight,
  CheckCircle2,
  Eye,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useBusinessFunds } from "@/components/business-funds/BusinessFundsContext";
import { useMockSession } from "@/components/session/MockSessionContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { getEditedOperations } from "@/lib/audit";
import { computeFinancialTotalsFromBalances } from "@/lib/finance";
import {
  type FinancialAlert,
  type FinancialAlertConfig,
  getFinancialAlertsOverview,
} from "@/lib/financialAlerts";
import { formatCurrency } from "@/lib/formatters";
import { AlertConfigurationSummary } from "./AlertConfigurationSummary";
import { alertToneStyles } from "./alertToneStyles";
import { BankAlertCard } from "./BankAlertCard";
import { MovementVisibilityPanel } from "./MovementVisibilityPanel";

const DEFAULT_LOW_BALANCE_THRESHOLD = 10000;
const DEFAULT_VISIBLE_MOVEMENT_LIMIT = 20;
const DEFAULT_MOVEMENT_WARNING_REMAINING = 5;

type AttentionLevel = "critical" | "warning" | "review";

type AttentionItem = {
  id: string;
  level: AttentionLevel;
  subject: string;
  title: string;
  detail: string;
  actionLabel: string;
  href: string;
};

export function BankAlertsPage() {
  const { cash, banks, operations } = useBusinessFunds();
  const { authenticatedUser } = useMockSession();
  const isOwner = authenticatedUser?.systemRole === "owner";
  const [config, setConfig] = useState<FinancialAlertConfig>(() => ({
    cash: {
      lowBalanceThreshold: DEFAULT_LOW_BALANCE_THRESHOLD,
    },
    banks: Object.fromEntries(
      banks.map((bank) => [
        bank.id,
        {
          lowBalanceThreshold: DEFAULT_LOW_BALANCE_THRESHOLD,
          visibleMovementTrackingEnabled:
            bank.visibleMovementTrackingEnabled === true,
          ...(bank.visibleMovementTrackingEnabled
            ? {
                visibleMovementLimit: DEFAULT_VISIBLE_MOVEMENT_LIMIT,
                visibleMovementsUsed: bank.visibleMovementsUsed ?? 0,
                movementWarningRemaining: DEFAULT_MOVEMENT_WARNING_REMAINING,
              }
            : {}),
        },
      ]),
    ),
  }));

  const totals = computeFinancialTotalsFromBalances({ cash, banks });
  const overview = getFinancialAlertsOverview({
    cash,
    banks,
    totals,
    movementAlerts: [],
    config,
  });
  const editedOperations = useMemo(
    () => getEditedOperations(operations),
    [operations],
  );
  const attentionItems = buildAttentionItems({
    alerts: overview.alerts,
    editedOperationsCount: isOwner ? editedOperations.length : 0,
    showAmounts: isOwner,
  });

  return (
    <div>
      <PageHeader
        title="Alertas"
        description="Revisa situaciones que pueden afectar la operación del negocio."
        action={
          <Link href="/balances" className="btn-secondary min-h-10">
            Ver Caja y bancos
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        }
      />

      <div className="space-y-6">
        <AttentionSection items={attentionItems} />

        <section>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-surface-text-primary">
                Estado para operar
              </h2>
              <p className="mt-0.5 text-sm text-surface-text-secondary">
                Caja física y bancos evaluados con el dinero disponible para
                operar.
              </p>
            </div>
            {isOwner && (
              <AlertConfigurationSummary
                resources={overview.resources}
                config={config}
                onSave={setConfig}
              />
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {overview.resources.map((resource) => (
              <BankAlertCard
                key={resource.id}
                resource={resource}
                showAmounts={isOwner}
              />
            ))}
          </div>
        </section>

        <MovementVisibilityPanel resources={overview.resources} />

        <section
          className={`rounded-lg border p-4 text-sm ${alertToneStyles.review.softPanel}`}
        >
          <div className="flex gap-3">
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <div>
              <p className="font-semibold">Alertas preparadas para corte</p>
              <p className="mt-1 text-surface-text-secondary">
                La pantalla ya reserva el lugar funcional para faltantes o
                sobrantes del último corte. Falta una fuente persistida de
                cierres anteriores para activar esa alerta sin inventar datos.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function AttentionSection({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <section
        className={`rounded-lg border p-5 ${alertToneStyles.success.softPanel}`}
      >
        <div className="flex items-start gap-3">
          <CheckCircle2
            className={`mt-0.5 h-5 w-5 ${alertToneStyles.success.text}`}
          />
          <div>
            <h2 className="text-lg font-semibold text-surface-text-primary">
              Todo está en orden
            </h2>
            <p className="mt-1 text-sm text-surface-text-secondary">
              No hay alertas que requieran atención.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const sortedItems = [...items].sort(
    (a, b) => levelWeight[a.level] - levelWeight[b.level],
  );

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-surface-text-primary">
          {items.length}{" "}
          {items.length === 1 ? "situación necesita" : "situaciones necesitan"}{" "}
          tu atención
        </h2>
      </div>
      <div className="space-y-3">
        {sortedItems.map((item) => (
          <article
            key={item.id}
            className={`rounded-lg border bg-white p-4 shadow-sm ${levelStyles[item.level].border}`}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-3">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${levelStyles[item.level].icon}`}
                >
                  {item.level === "critical" ? (
                    <AlertOctagon className="h-4 w-4" aria-hidden="true" />
                  ) : item.level === "review" ? (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <AlertCircle className="h-4 w-4" aria-hidden="true" />
                  )}
                </div>
                <div>
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${levelStyles[item.level].badge}`}
                  >
                    {levelStyles[item.level].label}
                  </span>
                  <p className="mt-2 text-sm font-semibold text-surface-text-primary">
                    {item.subject}
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-surface-text-primary">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-sm text-surface-text-secondary">
                    {item.detail}
                  </p>
                </div>
              </div>
              <Link href={item.href} className="btn-secondary w-fit">
                {item.actionLabel}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function buildAttentionItems({
  alerts,
  editedOperationsCount,
  showAmounts,
}: {
  alerts: FinancialAlert[];
  editedOperationsCount: number;
  showAmounts: boolean;
}): AttentionItem[] {
  const items = alerts.map((alert): AttentionItem => {
    const isCash = alert.resourceType === "cash";
    const isMovement =
      alert.type === "movement_limit_reached" ||
      alert.type === "movement_limit_warning";
    const title = getAlertTitle(alert);
    const detail = isMovement
      ? `${alert.remainingVisibleMovements ?? 0} movimientos visibles restantes.`
      : showAmounts
        ? `${formatCurrency(alert.available)} disponibles para operar. Mínimo configurado: ${
            alert.threshold !== undefined
              ? formatCurrency(alert.threshold)
              : "No configurado"
          }.`
        : "Saldo disponible bajo para operar.";

    return {
      id: `${alert.resourceId}-${alert.type}`,
      level: alert.severity === "critical" ? "critical" : "warning",
      subject: alert.resourceName,
      title,
      detail,
      actionLabel: isCash
        ? "Ver Caja y bancos"
        : isMovement
          ? "Ver banco"
          : "Ver banco",
      href: "/balances",
    };
  });

  if (editedOperationsCount > 0) {
    items.push({
      id: "edited-operations",
      level: "review",
      subject: "Auditoría",
      title: `${editedOperationsCount} ${
        editedOperationsCount === 1
          ? "operación fue modificada"
          : "operaciones fueron modificadas"
      }`,
      detail: "Hay cambios realizados por empleados que requieren revisión.",
      actionLabel: "Revisar cambios",
      href: "/audit",
    });
  }

  return items;
}

function getAlertTitle(alert: FinancialAlert): string {
  if (alert.resourceType === "cash") {
    return alert.severity === "critical"
      ? "Caja física en estado crítico"
      : "Caja física con poco dinero disponible";
  }

  if (alert.type === "movement_limit_reached") {
    return "Límite de movimientos visibles alcanzado";
  }

  if (alert.type === "movement_limit_warning") {
    return "Banco cerca del límite de movimientos visibles";
  }

  return alert.severity === "critical"
    ? "Saldo disponible crítico"
    : "Saldo disponible bajo";
}

const levelWeight: Record<AttentionLevel, number> = {
  critical: 0,
  warning: 1,
  review: 2,
};

const levelStyles: Record<
  AttentionLevel,
  { badge: string; border: string; icon: string; label: string }
> = {
  critical: {
    badge: alertToneStyles.critical.badge,
    border: alertToneStyles.critical.border,
    icon: alertToneStyles.critical.icon,
    label: "Crítico",
  },
  warning: {
    badge: alertToneStyles.warning.badge,
    border: alertToneStyles.warning.border,
    icon: alertToneStyles.warning.icon,
    label: "Atención",
  },
  review: {
    badge: alertToneStyles.review.badge,
    border: alertToneStyles.review.border,
    icon: alertToneStyles.review.icon,
    label: "Revisión",
  },
};
