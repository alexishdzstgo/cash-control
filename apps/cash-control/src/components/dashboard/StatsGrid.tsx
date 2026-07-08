import { MetricCard } from "@/components/system/MetricCard";

const metrics = [
  {
    title: "Caja física",
    value: "$12,450.00",
    description: "Disponible en caja.",
  },
  {
    title: "Saldo en bancos",
    value: "$54,320.00",
    description: "Total disponible en cuentas.",
  },
  {
    title: "Depósitos pendientes",
    value: "3",
    description: "Esperando entrega o revisión.",
  },
  {
    title: "Usuarios conectados",
    value: "4",
    description: "Operando en este momento.",
  },
];

export function StatsGrid() {
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