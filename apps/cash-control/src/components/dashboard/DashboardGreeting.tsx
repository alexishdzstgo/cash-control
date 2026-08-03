export function DashboardGreeting() {
  const now = new Date();
  const hour = now.getHours();

  const greeting =
    hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  const formattedDate = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);

  const formattedTime = new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);

  return (
    <section>
      <p className="mb-2 text-sm font-medium text-brand-primary">
        Cash Control
      </p>

      <h1 className="text-3xl font-bold tracking-tight text-slate-950">
        {greeting}, Alex
      </h1>

      <p className="mt-2 max-w-2xl text-slate-600">
        Todo listo para comenzar la operación.
      </p>

      <p className="mt-3 text-sm text-slate-500 capitalize">
        {formattedDate} · {formattedTime}
      </p>
    </section>
  );
}