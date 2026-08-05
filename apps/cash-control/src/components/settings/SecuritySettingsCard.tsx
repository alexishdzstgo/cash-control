import { SettingsCard, SettingsRow } from "./SettingsCard";

const securityRows = [
  ["Contraseña", "Pendiente de autenticación"],
  ["PIN del dueño", "Pendiente"],
  ["Sesiones", "Pendiente"],
  ["Autenticación en dos pasos", "Pendiente"],
  ["Recuperación de contraseña", "Pendiente"],
] as const;

export function SecuritySettingsCard() {
  return (
    <SettingsCard
      title="Seguridad"
      description="Preparado para integrarse con autenticación real en una fase posterior."
    >
      {securityRows.map(([label, value]) => (
        <SettingsRow key={label} label={label} value={value} />
      ))}
    </SettingsCard>
  );
}
