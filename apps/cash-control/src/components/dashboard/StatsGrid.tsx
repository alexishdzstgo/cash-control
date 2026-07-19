import { mockOperations } from "@/components/history/mockOperations";
import { MetricCard } from "@/components/system/MetricCard";
import { formatCurrency } from "@/lib/formatters";

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
    },
    {
      title: "Saldo en bancos",
      value: formatCurrency(54320),
      description: "Total disponible en cuentas.",
    },
    {
      title: "Retiros pendientes",
      value: String(pendingWithdrawals.length),
      description: `${formatCurrency(
        pendingWithdrawalsAmount,
      )} pendientes de entrega.`,
    },
    {
      title: "Usuarios conectados",
      value: "4",
      description: "Operando en este momento.",
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
        />
      ))}
    </section>
  );
}