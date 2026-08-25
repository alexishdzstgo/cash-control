"use client";

import { Clock3, Landmark, Users, Wallet } from "lucide-react";
import { useBusinessFunds } from "@/components/business-funds/BusinessFundsContext";
import { useMockSession } from "@/components/session/MockSessionContext";
import { MetricCard } from "@/components/system/MetricCard";
import { computeFinancialTotalsFromBalances } from "@/lib/finance";
import { formatCurrency } from "@/lib/formatters";

export function StatsGrid() {
  const { cash, banks, operations } = useBusinessFunds();
  const { participants } = useMockSession();
  const totals = computeFinancialTotalsFromBalances({ cash, banks });
  const pendingWithdrawals = operations.filter(
    (operation) =>
      operation.type === "retiro" && operation.status === "pendiente",
  );

  const pendingWithdrawalsAmount = pendingWithdrawals.reduce(
    (total, operation) => total + operation.amount,
    0,
  );

  const metrics = [
    {
      title: "Caja física",
      value: formatCurrency(totals.cashAvailable),
      description: "Disponible en caja.",
      secondaryText: "Estado inicial del turno.",
      icon: Wallet,
      accentClass: "bg-brand-responsible",
      iconClass: "bg-brand-responsible-soft text-brand-responsible",
      featured: true,
      className: "sm:col-span-2 xl:col-span-2",
    },
    {
      title: "Saldo en bancos",
      value: formatCurrency(totals.banksAvailable),
      description: "Total disponible en cuentas.",
      secondaryText: `${banks.length} cuentas activas.`,
      icon: Landmark,
      accentClass: "bg-blue-600",
      iconClass: "bg-blue-50 text-blue-700",
    },
    {
      title: "Retiros pendientes",
      value: String(pendingWithdrawals.length),
      description: `${formatCurrency(
        pendingWithdrawalsAmount,
      )} pendientes de entrega.`,
      secondaryText: "Requieren seguimiento.",
      icon: Clock3,
      href: "/pending-withdrawals",
      accentClass: "bg-pending-600",
      iconClass: "bg-pending-100 text-pending-700",
    },
    {
      title: "Usuarios conectados",
      value: String(
        participants.filter((participant) => participant.status === "active")
          .length,
      ),
      description: "Operando en este momento.",
      secondaryText: "Participantes activos del turno.",
      icon: Users,
      accentClass: "bg-violet-600",
      iconClass: "bg-violet-50 text-violet-700",
    },
  ];

  return (
    <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <MetricCard
          key={metric.title}
          title={metric.title}
          value={metric.value}
          description={metric.description}
          secondaryText={metric.secondaryText}
          icon={metric.icon}
          accentClass={metric.accentClass}
          iconClass={metric.iconClass}
          className={metric.className}
          href={metric.href}
          featured={metric.featured}
        />
      ))}
    </section>
  );
}
