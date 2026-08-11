"use client";

import { Check, Clock3, KeyRound, Pencil, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMockSession } from "@/components/session/MockSessionContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { SuccessDialog } from "@/components/shared/SuccessDialog";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { initialUserAccounts } from "@/components/users/userMockData";
import { areSameAvatar, generateAvatarOptions } from "@/lib/avatar";
import { getLastLoginLabel, getUserRoleLabel } from "@/lib/users";
import type { ProfilePreferences } from "@/types/profile";
import type { UserAccount, UserAvatar as UserAvatarModel } from "@/types/user";
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
    getUserAvatar,
    isCurrentUserResponsible,
    updateUserAvatar,
  } = useMockSession();
  const chooseAvatarButtonRef = useRef<HTMLButtonElement>(null);
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
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false);
  const [avatarDraft, setAvatarDraft] = useState<UserAvatarModel>({
    type: "initials",
  });
  const [successTitle, setSuccessTitle] = useState<string>("Acción registrada");
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
  const authenticatedUserId = authenticatedUser.userId;
  const activeParticipation = getActiveParticipation(authenticatedUser.userId);
  const isResponsible = isCurrentUserResponsible();
  const currentAvatar = getUserAvatar(authenticatedUserId);
  const avatarOptions = generateAvatarOptions({
    userId: authenticatedUserId,
  });

  function openAvatarDialog() {
    setAvatarDraft(currentAvatar ?? { type: "initials" });
    setIsAvatarDialogOpen(true);
  }

  function closeAvatarDialog() {
    setIsAvatarDialogOpen(false);
    chooseAvatarButtonRef.current?.focus();
  }

  function saveAvatar() {
    updateUserAvatar(authenticatedUserId, avatarDraft);
    setIsAvatarDialogOpen(false);
    chooseAvatarButtonRef.current?.focus();
    setSuccessTitle("Avatar actualizado correctamente.");
    setSuccessMessage(
      "Este cambio se conservará permanentemente cuando el sistema esté conectado a la base de datos.",
    );
  }

  function savePassword() {
    setPasswordForm(emptyPasswordForm);
    setIsPasswordFormOpen(false);
    setSuccessTitle("Acción registrada");
    setSuccessMessage(
      "Esta funcionalidad estará disponible cuando el sistema utilice autenticación real.",
    );
  }

  function savePreferences() {
    setPreferences(preferencesDraft);
    setIsEditingPreferences(false);
    setSuccessTitle("Acción registrada");
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
            action={
              <button
                ref={chooseAvatarButtonRef}
                type="button"
                className="btn-secondary"
                onClick={openAvatarDialog}
              >
                <Pencil className="h-4 w-4" />
                Elegir avatar
              </button>
            }
          >
            <div className="flex items-start gap-4">
              <UserAvatar
                name={profile.displayName}
                avatar={currentAvatar}
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

      <AvatarPickerDialog
        isOpen={isAvatarDialogOpen}
        name={profile.displayName}
        currentAvatar={currentAvatar}
        selectedAvatar={avatarDraft}
        options={avatarOptions}
        onSelect={setAvatarDraft}
        onClose={closeAvatarDialog}
        onSave={saveAvatar}
      />

      <SuccessDialog
        isOpen={successMessage !== null}
        title={successTitle}
        description={successMessage ?? ""}
        onClose={() => setSuccessMessage(null)}
      />
    </>
  );
}

function AvatarPickerDialog({
  isOpen,
  name,
  currentAvatar,
  selectedAvatar,
  options,
  onSelect,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  name: string;
  currentAvatar: UserAvatarModel | undefined;
  selectedAvatar: UserAvatarModel;
  options: UserAvatarModel[];
  onSelect: (avatar: UserAvatarModel) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    titleRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const initialsAvatar: UserAvatarModel = { type: "initials" };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-3 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-dialog-title"
        className="flex max-h-[90dvh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div>
            <h2
              id="avatar-dialog-title"
              ref={titleRef}
              tabIndex={-1}
              className="text-lg font-bold text-slate-950 outline-none"
            >
              Elige tu avatar
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Selecciona una imagen para identificar tu cuenta dentro del
              sistema.
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar selector de avatar"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">
                Vista previa
              </p>
              <div className="mt-4 flex justify-center">
                <UserAvatar
                  name={name}
                  avatar={selectedAvatar}
                  size="xl"
                  className="ring-4 ring-white"
                />
              </div>
              <p className="mt-4 text-center text-sm font-medium text-slate-700">
                {areSameAvatar(selectedAvatar, currentAvatar)
                  ? "Avatar actual"
                  : "Nueva selección"}
              </p>
            </aside>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <AvatarOptionButton
                label="Usar iniciales como avatar"
                name={name}
                avatar={initialsAvatar}
                selected={areSameAvatar(selectedAvatar, initialsAvatar)}
                onSelect={() => onSelect(initialsAvatar)}
              />
              {options.map((avatar, index) => (
                <AvatarOptionButton
                  key={avatar.type === "generated" ? avatar.seed : "initials"}
                  label={`Seleccionar avatar ${index + 1}`}
                  name={name}
                  avatar={avatar}
                  selected={areSameAvatar(selectedAvatar, avatar)}
                  onSelect={() => onSelect(avatar)}
                />
              ))}
            </div>
          </div>
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-slate-100 p-5 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Volver
          </button>
          <button type="button" className="btn-primary" onClick={onSave}>
            Guardar avatar
          </button>
        </footer>
      </div>
    </div>
  );
}

function AvatarOptionButton({
  label,
  name,
  avatar,
  selected,
  onSelect,
}: {
  label: string;
  name: string;
  avatar: UserAvatarModel;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onSelect}
      className={`group rounded-lg border p-3 text-center transition focus:outline-none focus:ring-2 focus:ring-[#2563EB] ${
        selected
          ? "border-[#2563EB] bg-[#EFF6FF] ring-2 ring-blue-100"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <div className="flex justify-center">
        <UserAvatar name={name} avatar={avatar} size="lg" />
      </div>
      <div className="mt-2 flex min-h-5 items-center justify-center gap-1 text-xs font-semibold text-slate-600">
        {selected && <Check className="h-3.5 w-3.5 text-[#2563EB]" />}
        <span>{selected ? "Seleccionado" : "Elegir"}</span>
      </div>
    </button>
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
