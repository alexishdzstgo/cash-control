import { Pencil } from "lucide-react";
import type { SystemSettings } from "@/types/settings";
import { SettingsCard, SettingsRow } from "./SettingsCard";

type SystemSettingsCardProps = {
  settings: SystemSettings;
  onEdit: () => void;
};

export function SystemSettingsCard({
  settings,
  onEdit,
}: SystemSettingsCardProps) {
  return (
    <SettingsCard
      title="Sistema"
      description="Preferencias generales de idioma, moneda y formatos."
      action={
        <button type="button" className="btn-secondary" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
          Editar
        </button>
      }
    >
      <SettingsRow label="Idioma" value={settings.language} />
      <SettingsRow label="Moneda" value={settings.currency} />
      <SettingsRow label="Zona horaria" value={settings.timezone} />
      <SettingsRow label="Formato fecha" value={settings.dateFormat} />
      <SettingsRow label="Formato hora" value={settings.timeFormat} />
    </SettingsCard>
  );
}
