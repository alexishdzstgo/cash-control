import { SettingsCard, SettingsRow } from "./SettingsCard";

const systemRows = [
  ["Proyecto", "Proyecto Cero"],
  ["Versión", "0.9.0"],
  ["Última actualización", "05/08/2026"],
  ["Desarrollado por", "Xolobit"],
  ["Licencia", "Demostración"],
  ["Entorno", "Mock"],
] as const;

const projectStatusRows = [
  ["Base de datos", "⏳ Pendiente"],
  ["Autenticación", "⏳ Pendiente"],
  ["Respaldo", "⏳ Pendiente"],
  ["Versión", "0.9.0 Demo"],
] as const;

export function SystemInformationCard() {
  return (
    <SettingsCard
      title="Información del sistema"
      description="Datos técnicos del MVP y estado de sus integraciones principales."
    >
      {systemRows.map(([label, value]) => (
        <SettingsRow key={label} label={label} value={value} />
      ))}

      <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 px-3 py-3">
        <p className="text-sm font-semibold text-slate-900">
          Estado del proyecto
        </p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Estado del sistema
        </p>
        <div className="mt-3 space-y-2">
          {projectStatusRows.map(([label, value]) => (
            <SettingsRow key={label} label={label} value={value} />
          ))}
        </div>
      </div>
    </SettingsCard>
  );
}
