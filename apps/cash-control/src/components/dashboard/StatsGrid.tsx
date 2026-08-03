import { mockOperations } from "@/components/history/mockOperations";
import { MetricCard } from "@/components/system/MetricCard";
import { formatCurrency } from "@/lib/formatters";
import { Wallet, Landmark, Clock3, Users } from "lucide-react";

export function StatsGrid() {
  const pendingWithdrawals = mockOperations.filter(
    (operation) =>
      operation.type === "retiro" &&
      operation.status === "pendiente",
  );

  const pendingWithdrawalsAmount =
    pendingWithdrawals.reduce(
      (total, operation) =>
        total + operation.amount,
      0,
    );

  const metrics = [
    {
      title: "Caja física",
      value: formatCurrency(12450),
      description: "Disponible en caja.",
      secondaryText: "Último movimiento hace 2 minutos.",
      icon: Wallet,
      accentClass: "bg-brand-responsible",
      iconClass: "bg-brand-responsible-soft text-brand-responsible",
      featured: true,
      className: "sm:col-span-2 xl:col-span-2",
    },
    {
      title: "Saldo en bancos",
      value: formatCurrency(54320),
      description: "Total disponible en cuentas.",
      secondaryText: "3 cuentas activas.",
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
      value: "4",
      description: "Operando en este momento.",
      secondaryText: "1 responsable · 3 apoyos.",
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