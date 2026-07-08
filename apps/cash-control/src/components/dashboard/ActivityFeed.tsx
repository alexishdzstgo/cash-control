const activities = [
  {
    time: "12:30",
    title: "Depósito entregado",
    detail: "Banco Azteca · $1,200.00",
  },
  {
    time: "12:18",
    title: "Transferencia registrada",
    detail: "BBVA · $800.00",
  },
  {
    time: "11:55",
    title: "Inicio de turno",
    detail: "Ana López inició operación.",
  },
];

export function ActivityFeed() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-950">
          Actividad reciente
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Últimos movimientos registrados en el negocio.
        </p>
      </div>

      <div className="space-y-5">
        {activities.map((activity) => (
          <div key={`${activity.time}-${activity.title}`} className="flex gap-4">
            <span className="text-sm font-medium text-slate-400">
              {activity.time}
            </span>

            <div>
              <p className="font-medium text-slate-900">{activity.title}</p>
              <p className="text-sm text-slate-500">{activity.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}