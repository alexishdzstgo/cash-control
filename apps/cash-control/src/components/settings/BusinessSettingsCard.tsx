import { ImageIcon, Pencil } from "lucide-react";
import type { BusinessSettings } from "@/types/settings";
import { SettingsCard, SettingsRow } from "./SettingsCard";

type BusinessSettingsCardProps = {
  settings: BusinessSettings;
  onEdit: () => void;
};

export function BusinessSettingsCard({
  settings,
  onEdit,
}: BusinessSettingsCardProps) {
  return (
    <SettingsCard
      title="Negocio"
      description="Identidad básica que se mostrará en pantallas administrativas."
      action={
        <button type="button" className="btn-secondary" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
          Editar
        </button>
      }
    >
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white text-slate-400">
          <ImageIcon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {settings.logoPlaceholder}
          </p>
          <p className="text-xs text-slate-500">
            Preparado para carga de logo futura.
          </p>
        </div>
      </div>
      <SettingsRow label="Nombre comercial" value={settings.businessName} />
      <SettingsRow label="Nombre corto" value={settings.shortName} />
      <SettingsRow label="Dirección" value={settings.address} />
      <SettingsRow label="Teléfono" value={settings.phone} />
    </SettingsCard>
  );
}
