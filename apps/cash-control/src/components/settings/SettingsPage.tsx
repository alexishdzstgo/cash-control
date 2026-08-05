"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { SuccessDialog } from "@/components/shared/SuccessDialog";
import type {
  BusinessSettings,
  OperationSettings,
  SettingsState,
  SystemSettings,
} from "@/types/settings";
import { BusinessSettingsCard } from "./BusinessSettingsCard";
import { ConfigEditDialog } from "./ConfigEditDialog";
import { ModulesSummaryCard } from "./ModulesSummaryCard";
import { OperationSettingsCard } from "./OperationSettingsCard";
import { SecuritySettingsCard } from "./SecuritySettingsCard";
import { SystemInformationCard } from "./SystemInformationCard";
import { SystemSettingsCard } from "./SystemSettingsCard";
import { initialSettingsState } from "./settingsMockData";

type EditableSection = "business" | "system" | "operation";

const successDescription =
  "Los cambios se mantendrán en esta sesión mock y serán permanentes cuando el sistema esté conectado a la base de datos.";

function buildFolioPreview(prefix: string, length: number, seed: number) {
  return `${prefix}-${String(seed).padStart(length, "0")}`;
}

export function SettingsPage() {
  const [settings, setSettings] = useState<SettingsState>(initialSettingsState);
  const [editingSection, setEditingSection] = useState<EditableSection | null>(
    null,
  );
  const [businessDraft, setBusinessDraft] = useState<BusinessSettings>(
    initialSettingsState.business,
  );
  const [systemDraft, setSystemDraft] = useState<SystemSettings>(
    initialSettingsState.system,
  );
  const [operationDraft, setOperationDraft] = useState<OperationSettings>(
    initialSettingsState.operation,
  );
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);

  const dialogTitle = useMemo(() => {
    if (editingSection === "business") {
      return "Editar negocio";
    }
    if (editingSection === "system") {
      return "Editar sistema";
    }
    if (editingSection === "operation") {
      return "Editar operación";
    }
    return "";
  }, [editingSection]);

  function openEditor(section: EditableSection) {
    if (section === "business") {
      setBusinessDraft(settings.business);
    }
    if (section === "system") {
      setSystemDraft(settings.system);
    }
    if (section === "operation") {
      setOperationDraft(settings.operation);
    }
    setEditingSection(section);
  }

  function closeEditor() {
    setEditingSection(null);
  }

  function saveEditor() {
    if (editingSection === "business") {
      setSettings((current) => ({ ...current, business: businessDraft }));
    }
    if (editingSection === "system") {
      setSettings((current) => ({ ...current, system: systemDraft }));
    }
    if (editingSection === "operation") {
      const normalizedLength = Math.min(
        12,
        Math.max(1, operationDraft.folioLength),
      );
      const normalizedOperation = {
        ...operationDraft,
        folioLength: normalizedLength,
        depositPreview: buildFolioPreview(
          operationDraft.depositPrefix,
          normalizedLength,
          125,
        ),
        withdrawalPreview: buildFolioPreview(
          operationDraft.withdrawalPrefix,
          normalizedLength,
          231,
        ),
      };
      setOperationDraft(normalizedOperation);
      setSettings((current) => ({
        ...current,
        operation: normalizedOperation,
      }));
    }
    setEditingSection(null);
    setIsSuccessOpen(true);
  }

  return (
    <>
      <PageHeader
        title="Centro de configuración"
        description="Personaliza el comportamiento general del sistema y consulta el estado de sus principales configuraciones."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <BusinessSettingsCard
          settings={settings.business}
          onEdit={() => openEditor("business")}
        />
        <SystemSettingsCard
          settings={settings.system}
          onEdit={() => openEditor("system")}
        />
        <OperationSettingsCard
          settings={settings.operation}
          onEdit={() => openEditor("operation")}
        />
        <ModulesSummaryCard />
        <SecuritySettingsCard />
        <SystemInformationCard />
      </div>

      <ConfigEditDialog
        isOpen={editingSection !== null}
        title={dialogTitle}
        description="Ajusta la configuración mock. La persistencia real queda pendiente para Supabase."
        onClose={closeEditor}
        onSave={saveEditor}
      >
        {editingSection === "business" && (
          <BusinessSettingsFields
            draft={businessDraft}
            onChange={setBusinessDraft}
          />
        )}
        {editingSection === "system" && (
          <SystemSettingsFields draft={systemDraft} onChange={setSystemDraft} />
        )}
        {editingSection === "operation" && (
          <OperationSettingsFields
            draft={operationDraft}
            onChange={setOperationDraft}
          />
        )}
      </ConfigEditDialog>

      <SuccessDialog
        isOpen={isSuccessOpen}
        title="Configuración actualizada correctamente."
        description={successDescription}
        onClose={() => setIsSuccessOpen(false)}
      />
    </>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function TextField({ label, value, onChange }: FieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

function BusinessSettingsFields({
  draft,
  onChange,
}: {
  draft: BusinessSettings;
  onChange: (draft: BusinessSettings) => void;
}) {
  return (
    <div className="space-y-4">
      <TextField
        label="Nombre comercial"
        value={draft.businessName}
        onChange={(businessName) => onChange({ ...draft, businessName })}
      />
      <TextField
        label="Nombre corto"
        value={draft.shortName}
        onChange={(shortName) => onChange({ ...draft, shortName })}
      />
      <TextField
        label="Dirección"
        value={draft.address}
        onChange={(address) => onChange({ ...draft, address })}
      />
      <TextField
        label="Teléfono"
        value={draft.phone}
        onChange={(phone) => onChange({ ...draft, phone })}
      />
      <TextField
        label="Logo"
        value={draft.logoPlaceholder}
        onChange={(logoPlaceholder) => onChange({ ...draft, logoPlaceholder })}
      />
    </div>
  );
}

function SystemSettingsFields({
  draft,
  onChange,
}: {
  draft: SystemSettings;
  onChange: (draft: SystemSettings) => void;
}) {
  return (
    <div className="space-y-4">
      <TextField
        label="Idioma"
        value={draft.language}
        onChange={(language) => onChange({ ...draft, language })}
      />
      <TextField
        label="Moneda"
        value={draft.currency}
        onChange={(currency) => onChange({ ...draft, currency })}
      />
      <TextField
        label="Zona horaria"
        value={draft.timezone}
        onChange={(timezone) => onChange({ ...draft, timezone })}
      />
      <TextField
        label="Formato fecha"
        value={draft.dateFormat}
        onChange={(dateFormat) => onChange({ ...draft, dateFormat })}
      />
      <TextField
        label="Formato hora"
        value={draft.timeFormat}
        onChange={(timeFormat) => onChange({ ...draft, timeFormat })}
      />
      <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm leading-6 text-blue-700">
        Los cambios se conservarán cuando el sistema utilice una base de datos.
      </p>
    </div>
  );
}

function OperationSettingsFields({
  draft,
  onChange,
}: {
  draft: OperationSettings;
  onChange: (draft: OperationSettings) => void;
}) {
  const lengthValue = String(draft.folioLength);

  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3 rounded-lg border border-slate-200 px-3 py-3">
        <input
          type="checkbox"
          checked={draft.carryFinalCashToNextShift}
          onChange={(event) =>
            onChange({
              ...draft,
              carryFinalCashToNextShift: event.target.checked,
            })
          }
          className="mt-1 h-4 w-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
        />
        <span>
          <span className="block text-sm font-medium text-slate-700">
            Caja disponible final pasa automáticamente al siguiente turno
          </span>
          <span className="mt-1 block text-sm text-slate-500">
            Indicador visual mock; no cambia la lógica actual de turnos.
          </span>
        </span>
      </label>
      <TextField
        label="Prefijo depósitos"
        value={draft.depositPrefix}
        onChange={(depositPrefix) => onChange({ ...draft, depositPrefix })}
      />
      <TextField
        label="Prefijo retiros"
        value={draft.withdrawalPrefix}
        onChange={(withdrawalPrefix) =>
          onChange({ ...draft, withdrawalPrefix })
        }
      />
      <label className="block">
        <span className="text-sm font-medium text-slate-700">
          Longitud del folio
        </span>
        <input
          type="number"
          min={1}
          max={12}
          value={lengthValue}
          onChange={(event) =>
            onChange({
              ...draft,
              folioLength: Number(event.target.value) || 1,
            })
          }
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
        />
      </label>
    </div>
  );
}
