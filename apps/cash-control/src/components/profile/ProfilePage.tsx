"use client";

import { Clock3, KeyRound, Pencil } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMockSession } from "@/components/session/MockSessionContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { SuccessDialog } from "@/components/shared/SuccessDialog";
import { UserInitialsAvatar } from "@/components/shared/UserInitialsAvatar";
import { initialUserAccounts } from "@/components/users/userMockData";
import { getLastLoginLabel, getUserRoleLabel } from "@/lib/users";
import type { ProfilePreferences } from "@/types/profile";
import type { UserAccount } from "@/types/user";
import { initialProfilePreferences } from "./profileMockData";

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const emptyPasswordForm: PasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const pendingAuthItems = [
  "PIN",
  "Autenticación en dos pasos",
  "Sesiones activas",
  "Dispositivos autorizados",
  "Correo electrónico",
] as const;

export function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    authenticatedUser,
    getActiveParticipation,
    isCurrentUserResponsible,
  } = useMockSession();
  const [isPasswordFormOpen, setIsPasswordFormOpen] = useState(false);
  const [passwordForm, setPasswordForm] =
    useState<PasswordForm>(emptyPasswordForm);
  const [preferences, setPreferences] = useState<ProfilePreferences>(
    initialProfilePreferences,
  );
  const [preferencesDraft, setPreferencesDraft] = useState<ProfilePreferences>(
    initialProfilePreferences,
  );
  const [isEditingPreferences, setIsEditingPreferences] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authenticatedUser) {
      router.replace("/workstation");
    }
  }, [authenticatedUser, router]);

  useEffect(() => {
    const section = searchParams.get("section");
    if (section === "security") {
      setIsPasswordFormOpen(true);
    }
    if (section === "preferences") {
      setPreferencesDraft(preferences);
      setIsEditingPreferences(true);
    }
  }, [searchParams, preferences]);

  const account = useMemo(
    () =>
      authenticatedUser
        ? initialUserAccounts.find(
            (user) => user.id === authenticatedUser.userId,
          )
        : undefined,
    [authenticatedUser],
  );

  if (!authenticatedUser) {
    return null;
  }

  const profile = buildProfileView(authenticatedUser, account);
  const activeParticipation = getActiveParticipation(authenticatedUser.userId);
  const isResponsible = isCurrentUserResponsible();

  function savePassword() {
    setPasswordForm(emptyPasswordForm);
    setIsPasswordFormOpen(false);
    setSuccessMessage(
      "Esta funcionalidad estará disponible cuando el sistema utilice autenticación real.",
    );
  }

  function savePreferences() {
    setPreferences(preferencesDraft);
    setIsEditingPreferences(false);
    setSuccessMessage("Preferencias mock actualizadas correctamente.");
  }

  return (
    <>
      <PageHeader
        title="Mi perfil"
        description="Consulta la información de tu cuenta y personaliza tus preferencias."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <ProfileCard
            title="Información personal"
            description="Datos visibles de la cuenta autenticada."
          >
            <div className="flex items-start gap-4">
              <UserInitialsAvatar
                name={profile.displayName}
                imageUrl={profile.avatar}
                size="lg"
              />
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-slate-950">
                  {profile.displayName}
                </h2>
                <p className="font-mono text-sm text-slate-500">
                  {profile.username}
                </p>
              </div>
            </div>
            <ProfileRows
              rows={[
                ["Rol", getUserRoleLabel(profile.systemRole)],
                ["Estado", profile.statusLabel],
                ["Fecha de alta", profile.createdAtLabel],
              ]}
            />
          </ProfileCard>

          <ProfileCard
            title="Estado"
            description="Información derivada de la participación actual."
          >
            <ProfileRows
              rows={[
                ["Participación", activeParticipation ? "Activa" : "Inactiva"],
                ["Responsable actual", isResponsible ? "Sí" : "No"],
                ["Turno", activeParticipation ? "Turno actual" : "Sin turno"],
              ]}
            />
          </ProfileCard>

          <ProfileCard
            title="Actividad"
            description="Estado de actividad disponible en la sesión mock."
          >
            {activeParticipation ? (
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Clock3 className="h-4 w-4 text-[#2563EB]" />
                  Participación iniciada
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Inicio registrado a las {activeParticipation.startedAt}.
                </p>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                Sin participación activa en este momento.
              </p>
            )}
          </ProfileCard>
        </div>

        <div className="space-y-6">
          <ProfileCard
            title="Seguridad"
            description="Preparado para Supabase Auth en una fase posterior."
            action={
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsPasswordFormOpen((current) => !current)}
              >
                <KeyRound className="h-4 w-4" />
                Cambiar contraseña
              </button>
            }
          >
            <ProfileRows
              rows={[
                ["Contraseña", "••••••••"],
                ["Último cambio", "Pendiente"],
              ]}
            />
            {isPasswordFormOpen && (
              <div className="mt-4 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <PasswordField
                  label="Contraseña actual"
                  value={passwordForm.currentPassword}
                  onChange={(currentPassword) =>
                    setPasswordForm((current) => ({
                      ...current,
                      currentPassword,
                    }))
                  }
                />
                <PasswordField
                  label="Nueva contraseña"
                  value={passwordForm.newPassword}
                  onChange={(newPassword) =>
                    setPasswordForm((current) => ({
                      ...current,
                      newPassword,
                    }))
                  }
                />
                <PasswordField
                  label="Confirmar contraseña"
                  value={passwordForm.confirmPassword}
                  onChange={(confirmPassword) =>
                    setPasswordForm((current) => ({
                      ...current,
                      confirmPassword,
                    }))
                  }
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={savePassword}
                  >
                    Guardar
                  </button>
                </div>
              </div>
            )}
          </ProfileCard>

          <ProfileCard
            title="Preferencias"
            description="Cambios mock para la experiencia del usuario actual."
            action={
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setPreferencesDraft(preferences);
                  setIsEditingPreferences(true);
                }}
              >
                <Pencil className="h-4 w-4" />
                Editar
              </button>
            }
          >
            {isEditingPreferences ? (
              <PreferencesForm
                draft={preferencesDraft}
                onChange={setPreferencesDraft}
                onSave={savePreferences}
                onCancel={() => setIsEditingPreferences(false)}
              />
            ) : (
              <ProfileRows rows={buildPreferenceRows(preferences)} />
            )}
          </ProfileCard>

          <ProfileCard
            title="Información de cuenta"
            description="Datos no editables asociados a la cuenta actual."
          >
            <ProfileRows
              rows={[
                ["Cuenta creada", profile.createdAtLabel],
                ["Último acceso", profile.lastLoginLabel],
                ["Versión del sistema", "0.9.0 Demo"],
                ["Entorno", "Mock"],
                ["Rol", getUserRoleLabel(profile.systemRole)],
              ]}
            />
          </ProfileCard>

          <ProfileCard
            title="Próximamente"
            description="Funciones reservadas para autenticación real."
            muted
          >
            <div className="space-y-3">
              {pendingAuthItems.map((item) => (
                <div
                  key={item}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <span className="text-sm font-medium text-slate-700">
                    {item}
                  </span>
                  <span className="text-right text-sm text-slate-500">
                    Pendiente de autenticación.
                  </span>
                </div>
              ))}
            </div>
          </ProfileCard>
        </div>
      </div>

      <SuccessDialog
        isOpen={successMessage !== null}
        title="Acción registrada"
        description={successMessage ?? ""}
        onClose={() => setSuccessMessage(null)}
      />
    </>
  );
}

function ProfileCard({
  title,
  description,
  action,
  muted = false,
  children,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-xl border p-5 shadow-sm ${
        muted ? "border-slate-200 bg-slate-50" : "border-slate-200 bg-white"
      }`}
    >
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ProfileRows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="grid gap-3">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="text-sm text-slate-500">{label}</span>
          <span className="break-words text-sm font-semibold text-slate-900 sm:text-right">
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      <input
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field-input"
      />
    </label>
  );
}

function PreferencesForm({
  draft,
  onChange,
  onSave,
  onCancel,
}: {
  draft: ProfilePreferences;
  onChange: (draft: ProfilePreferences) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <TextField
        label="Idioma"
        value={draft.language}
        onChange={(language) => onChange({ ...draft, language })}
      />
      <TextField
        label="Tema"
        value={draft.theme}
        onChange={(theme) => onChange({ ...draft, theme })}
      />
      <TextField
        label="Formato hora"
        value={draft.timeFormat}
        onChange={(timeFormat) => onChange({ ...draft, timeFormat })}
      />
      <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3">
        <input
          type="checkbox"
          checked={draft.animationsEnabled}
          onChange={(event) =>
            onChange({ ...draft, animationsEnabled: event.target.checked })
          }
          className="mt-1 h-4 w-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
        />
        <span className="text-sm font-semibold text-slate-700">
          Animaciones activadas
        </span>
      </label>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className="btn-primary" onClick={onSave}>
          Guardar
        </button>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field-input"
      />
    </label>
  );
}

function buildPreferenceRows(
  preferences: ProfilePreferences,
): Array<[string, string]> {
  return [
    ["Idioma", preferences.language],
    ["Tema", preferences.theme],
    ["Formato hora", preferences.timeFormat],
    ["Animaciones", preferences.animationsEnabled ? "Activadas" : "Inactivas"],
  ];
}

function buildProfileView(
  authenticatedUser: {
    userId: string;
    userName: string;
    systemRole: UserAccount["systemRole"];
  },
  account: UserAccount | undefined,
) {
  return {
    displayName: account?.displayName ?? authenticatedUser.userName,
    username: account?.username ?? authenticatedUser.userId,
    systemRole: authenticatedUser.systemRole,
    statusLabel: account
      ? account.status === "active"
        ? "Activo"
        : "Suspendido"
      : "Activo",
    createdAtLabel: account ? formatDate(account.createdAt) : "Pendiente",
    lastLoginLabel: account
      ? getLastLoginLabel(account.lastLogin)
      : "Sesión actual",
    avatar: account?.avatar,
  };
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
