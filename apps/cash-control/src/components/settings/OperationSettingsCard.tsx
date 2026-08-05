import { Pencil } from "lucide-react";
import type { OperationSettings } from "@/types/settings";
import { SettingsCard, SettingsRow } from "./SettingsCard";

type OperationSettingsCardProps = {
  settings: OperationSettings;
  onEdit: () => void;
};

export function OperationSettingsCard({
  settings,
  onEdit,
}: OperationSettingsCardProps) {
  return (
    <SettingsCard
      title="Operación"
      description="Parámetros operativos visibles sin modificar reglas actuales."
      action={
        <button type="button" className="btn-secondary" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
          Editar
        </button>
      }
    >
      <SettingsRow
        label="Caja disponible final pasa automáticamente al siguiente turno"
        value={settings.carryFinalCashToNextShift ? "Sí" : "No"}
      />
      <SettingsRow label="Prefijo depósitos" value={settings.depositPrefix} />
      <SettingsRow label="Prefijo retiros" value={settings.withdrawalPrefix} />
      <SettingsRow
        label="Longitud del folio"
        value={String(settings.folioLength)}
      />
      <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
        <p className="text-sm text-slate-500">Vista previa</p>
        <p className="mt-1 font-mono text-sm font-semibold text-slate-900">
          {settings.depositPreview} · {settings.withdrawalPreview}
        </p>
      </div>
    </SettingsCard>
  );
}
