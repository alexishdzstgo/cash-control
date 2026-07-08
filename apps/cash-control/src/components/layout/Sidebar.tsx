export function Sidebar() {
  return (
    <aside className="w-60 border-r bg-slate-900 text-white">
      <div className="border-b border-slate-800 p-6">
        <h2 className="text-lg font-bold">
          Xolobit
        </h2>

        <p className="text-sm text-slate-400">
          Cash Control
        </p>
      </div>

      <nav className="p-4">
        <ul className="space-y-2">
          <li>🏠 Dashboard</li>
          <li>💰 Depósitos</li>
          <li>🔄 Transferencias</li>
          <li>🏦 Bancos</li>
          <li>📊 Corte de Caja</li>
          <li>👥 Turnos</li>
          <li>📋 Historial</li>
          <li>⚙ Configuración</li>
        </ul>
      </nav>
    </aside>
  );
}