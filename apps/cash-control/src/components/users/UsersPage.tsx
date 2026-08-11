"use client";

import {
  Eye,
  KeyRound,
  Pencil,
  Plus,
  RotateCcw,
  ShieldCheck,
  UserMinus,
  UserX,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { mockOperations } from "@/components/history/mockOperations";
import { useMockSession } from "@/components/session/MockSessionContext";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { UserAvatar } from "@/components/shared/UserAvatar";
import {
  filterUsers,
  generateTemporaryPassword,
  getLastLoginLabel,
  getUserActivityEvents,
  getUserParticipation,
  getUserRoleLabel,
  getUserStats,
  getUserStatusLabel,
  getUserSummary,
  wouldRemoveLastActiveOwner,
} from "@/lib/users";
import type { UserAccount, UserFilter } from "@/types/user";
import { initialUserAccounts } from "./userMockData";

type DetailTab = "info" | "access" | "activity" | "stats";
type FormMode = "create" | "edit";
type ConfirmState =
  | { type: "suspend"; user: UserAccount }
  | { type: "reactivate"; user: UserAccount }
  | { type: "reset-password"; user: UserAccount }
  | null;

type UserFormState = {
  firstName: string;
  lastName: string;
  username: string;
  systemRole: UserAccount["systemRole"];
  status: UserAccount["status"];
  temporaryPassword: string;
  internalNotes: string;
};

const emptyForm: UserFormState = {
  firstName: "",
  lastName: "",
  username: "",
  systemRole: "employee",
  status: "active",
  temporaryPassword: "",
  internalNotes: "",
};

const filters: Array<{ value: UserFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "owners", label: "Dueños" },
  { value: "employees", label: "Empleados" },
  { value: "active", label: "Activos" },
  { value: "suspended", label: "Suspendidos" },
];

export function UsersPage() {
  const { getUserAvatar, participants } = useMockSession();
  const [users, setUsers] = useState<UserAccount[]>(initialUserAccounts);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<UserFilter>("all");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    initialUserAccounts[0]?.id ?? null,
  );
  const [detailTab, setDetailTab] = useState<DetailTab>("info");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [formStep, setFormStep] = useState<1 | 2>(1);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [form, setForm] = useState<UserFormState>({
    ...emptyForm,
    temporaryPassword: generateTemporaryPassword(),
  });
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [domainMessage, setDomainMessage] = useState<string | null>(null);
  const [passwordResult, setPasswordResult] = useState<{
    user: UserAccount;
    password: string;
  } | null>(null);

  const summary = useMemo(() => getUserSummary(users), [users]);
  const filteredUsers = useMemo(
    () => filterUsers(users, search, filter),
    [users, search, filter],
  );
  const selectedUser =
    users.find((user) => user.id === selectedUserId) ??
    filteredUsers[0] ??
    null;

  function openCreateForm() {
    setDomainMessage(null);
    setFormMode("create");
    setFormStep(1);
    setEditingUserId(null);
    setForm({ ...emptyForm, temporaryPassword: generateTemporaryPassword() });
    setIsFormOpen(true);
  }

  function openEditForm(user: UserAccount) {
    setDomainMessage(null);
    setFormMode("edit");
    setFormStep(1);
    setEditingUserId(user.id);
    setForm({
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      systemRole: user.systemRole,
      status: user.status,
      temporaryPassword: user.temporaryPassword,
      internalNotes: user.internalNotes,
    });
    setIsFormOpen(true);
  }

  function submitForm() {
    if (
      !form.firstName.trim() ||
      !form.lastName.trim() ||
      !form.username.trim()
    ) {
      setDomainMessage("Completa nombre, apellidos y usuario.");
      return;
    }

    if (formMode === "edit" && editingUserId) {
      const nextUser: Partial<UserAccount> = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        displayName: `${form.firstName.trim()} ${form.lastName.trim()}`,
        username: form.username.trim(),
        systemRole: form.systemRole,
        status: form.status,
        internalNotes: form.internalNotes.trim(),
      };

      if (wouldRemoveLastActiveOwner(users, editingUserId, nextUser)) {
        setDomainMessage(
          "Debe existir al menos un dueño activo en el sistema.",
        );
        return;
      }

      setUsers((current) =>
        current.map((user) =>
          user.id === editingUserId ? { ...user, ...nextUser } : user,
        ),
      );
      setSelectedUserId(editingUserId);
    } else {
      const id = form.username.trim().toLowerCase().replaceAll(".", "-");
      const newUser: UserAccount = {
        id: `${id}-${Date.now()}`,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        displayName: `${form.firstName.trim()} ${form.lastName.trim()}`,
        username: form.username.trim(),
        systemRole: form.systemRole,
        status: form.status,
        avatar: undefined,
        createdAt: new Date().toISOString(),
        lastLogin: "never",
        temporaryPassword: form.temporaryPassword,
        internalNotes: form.internalNotes.trim(),
        authUserId: undefined,
        profileId: undefined,
        passwordRecoveryStatus: "not_configured",
        sessionsReady: false,
      };
      setUsers((current) => [...current, newUser]);
      setSelectedUserId(newUser.id);
    }

    setIsFormOpen(false);
    setDomainMessage(null);
  }

  function requestStatusChange(user: UserAccount) {
    setDomainMessage(null);
    if (user.status === "active") {
      if (
        wouldRemoveLastActiveOwner(users, user.id, {
          status: "suspended",
        })
      ) {
        setDomainMessage(
          "Debe existir al menos un dueño activo en el sistema.",
        );
        return;
      }
      setConfirmState({ type: "suspend", user });
      return;
    }
    setConfirmState({ type: "reactivate", user });
  }

  function confirmAction() {
    if (!confirmState) return;

    if (confirmState.type === "reset-password") {
      const password = generateTemporaryPassword();
      setUsers((current) =>
        current.map((user) =>
          user.id === confirmState.user.id
            ? { ...user, temporaryPassword: password }
            : user,
        ),
      );
      setPasswordResult({ user: confirmState.user, password });
      setConfirmState(null);
      return;
    }

    const nextStatus = confirmState.type === "suspend" ? "suspended" : "active";
    setUsers((current) =>
      current.map((user) =>
        user.id === confirmState.user.id
          ? { ...user, status: nextStatus }
          : user,
      ),
    );
    setConfirmState(null);
  }

  return (
    <div>
      <PageHeader
        title="Administración de usuarios"
        description="Administra las cuentas con acceso al sistema."
        action={
          <button
            type="button"
            className="btn-primary"
            onClick={openCreateForm}
          >
            <Plus className="h-4 w-4" />
            Crear usuario
          </button>
        }
      />

      <div className="space-y-6">
        <UserSummaryCards summary={summary} />

        {domainMessage && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            {domainMessage}
          </div>
        )}

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre o usuario"
              className="field-input lg:max-w-sm"
            />
            <div className="flex flex-wrap gap-2">
              {filters.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFilter(item.value)}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                    filter === item.value
                      ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <UsersList
            users={filteredUsers}
            selectedUserId={selectedUser?.id ?? null}
            getUserAvatar={getUserAvatar}
            onSelect={(user) => {
              setSelectedUserId(user.id);
              setDetailTab("info");
            }}
            onEdit={openEditForm}
            onStatusChange={requestStatusChange}
            onResetPassword={(user) =>
              setConfirmState({ type: "reset-password", user })
            }
          />

          <UserDetails
            user={selectedUser}
            tab={detailTab}
            onTabChange={setDetailTab}
            participants={participants}
            getUserAvatar={getUserAvatar}
            onEdit={openEditForm}
            onStatusChange={requestStatusChange}
            onResetPassword={(user) =>
              setConfirmState({ type: "reset-password", user })
            }
          />
        </div>
      </div>

      <UserFormPanel
        isOpen={isFormOpen}
        mode={formMode}
        step={formStep}
        form={form}
        message={domainMessage}
        onStepChange={setFormStep}
        onChange={(updates) =>
          setForm((current) => ({ ...current, ...updates }))
        }
        onClose={() => {
          setIsFormOpen(false);
          setDomainMessage(null);
        }}
        onSubmit={submitForm}
      />

      <ConfirmDialog
        isOpen={confirmState !== null}
        title={getConfirmTitle(confirmState)}
        description={getConfirmDescription(confirmState)}
        confirmLabel={getConfirmLabel(confirmState)}
        cancelLabel="Cancelar"
        onConfirm={confirmAction}
        onCancel={() => setConfirmState(null)}
      />

      {passwordResult && (
        <PasswordResultDialog
          user={passwordResult.user}
          password={passwordResult.password}
          onClose={() => setPasswordResult(null)}
        />
      )}
    </div>
  );
}

function UserSummaryCards({
  summary,
}: {
  summary: ReturnType<typeof getUserSummary>;
}) {
  const cards = [
    { label: "Usuarios registrados", value: summary.total },
    { label: "Dueños", value: summary.owners },
    { label: "Empleados", value: summary.employees },
    { label: "Suspendidos", value: summary.suspended },
  ];

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <p className="text-sm font-medium text-slate-500">{card.label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{card.value}</p>
        </div>
      ))}
    </section>
  );
}

function UsersList({
  users,
  selectedUserId,
  getUserAvatar,
  onSelect,
  onEdit,
  onStatusChange,
  onResetPassword,
}: {
  users: UserAccount[];
  selectedUserId: string | null;
  getUserAvatar: ReturnType<typeof useMockSession>["getUserAvatar"];
  onSelect: (user: UserAccount) => void;
  onEdit: (user: UserAccount) => void;
  onStatusChange: (user: UserAccount) => void;
  onResetPassword: (user: UserAccount) => void;
}) {
  if (users.length === 0) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
        No hay usuarios que coincidan con la búsqueda.
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Avatar</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Último acceso</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => (
              <tr
                key={user.id}
                className={
                  selectedUserId === user.id ? "bg-blue-50/50" : "bg-white"
                }
              >
                <td className="px-4 py-4">
                  <UserAvatar
                    name={user.displayName}
                    avatar={getUserAvatar(user.id)}
                  />
                </td>
                <td className="px-4 py-4 font-semibold text-slate-900">
                  {user.displayName}
                </td>
                <td className="px-4 py-4 font-mono text-xs text-slate-600">
                  {user.username}
                </td>
                <td className="px-4 py-4">
                  <RoleBadge role={user.systemRole} />
                </td>
                <td className="px-4 py-4">
                  <StatusBadge status={user.status} />
                </td>
                <td className="px-4 py-4 text-slate-600">
                  {getLastLoginLabel(user.lastLogin)}
                </td>
                <td className="px-4 py-4">
                  <ActionButtons
                    user={user}
                    onView={() => onSelect(user)}
                    onEdit={() => onEdit(user)}
                    onStatusChange={() => onStatusChange(user)}
                    onResetPassword={() => onResetPassword(user)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-slate-100 lg:hidden">
        {users.map((user) => (
          <div key={user.id} className="p-4">
            <div className="flex items-start gap-3">
              <UserAvatar
                name={user.displayName}
                avatar={getUserAvatar(user.id)}
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-950">
                  {user.displayName}
                </p>
                <p className="font-mono text-xs text-slate-500">
                  {user.username}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <RoleBadge role={user.systemRole} />
                  <StatusBadge status={user.status} />
                </div>
              </div>
            </div>
            <div className="mt-3">
              <ActionButtons
                user={user}
                onView={() => onSelect(user)}
                onEdit={() => onEdit(user)}
                onStatusChange={() => onStatusChange(user)}
                onResetPassword={() => onResetPassword(user)}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function UserDetails({
  user,
  tab,
  onTabChange,
  participants,
  getUserAvatar,
  onEdit,
  onStatusChange,
  onResetPassword,
}: {
  user: UserAccount | null;
  tab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  participants: ReturnType<typeof useMockSession>["participants"];
  getUserAvatar: ReturnType<typeof useMockSession>["getUserAvatar"];
  onEdit: (user: UserAccount) => void;
  onStatusChange: (user: UserAccount) => void;
  onResetPassword: (user: UserAccount) => void;
}) {
  if (!user) {
    return (
      <aside className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        Selecciona un usuario para ver su ficha.
      </aside>
    );
  }

  const participation = getUserParticipation(user, participants);
  const activities = getUserActivityEvents(user, mockOperations);
  const stats = getUserStats(user, mockOperations, participants);

  return (
    <aside className="rounded-xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-6 xl:self-start">
      <div className="border-b border-slate-100 p-5">
        <div className="flex items-start gap-4">
          <UserAvatar
            name={user.displayName}
            avatar={getUserAvatar(user.id)}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-slate-950">
              {user.displayName}
            </h2>
            <p className="font-mono text-xs text-slate-500">{user.username}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <RoleBadge role={user.systemRole} />
              <StatusBadge status={user.status} />
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onEdit(user)}
          >
            <Pencil className="h-4 w-4" />
            Editar
          </button>
          <button
            type="button"
            className={
              user.status === "active"
                ? "inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                : "btn-secondary"
            }
            onClick={() => onStatusChange(user)}
          >
            {user.status === "active" ? (
              <UserX className="h-4 w-4" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            {user.status === "active" ? "Suspender" : "Reactivar"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onResetPassword(user)}
          >
            <KeyRound className="h-4 w-4" />
            Restablecer
          </button>
        </div>
      </div>

      <div className="flex overflow-x-auto border-b border-slate-100 px-4">
        {[
          { value: "info", label: "Información" },
          { value: "access", label: "Accesos" },
          { value: "activity", label: "Actividad" },
          { value: "stats", label: "Estadísticas" },
        ].map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onTabChange(item.value as DetailTab)}
            className={`border-b-2 px-3 py-3 text-sm font-semibold transition ${
              tab === item.value
                ? "border-[#2563EB] text-[#2563EB]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="p-5">
        {tab === "info" && (
          <div className="space-y-4">
            <InfoRow label="Nombre" value={user.displayName} />
            <InfoRow label="Usuario" value={user.username} />
            <InfoRow label="Rol" value={getUserRoleLabel(user.systemRole)} />
            <InfoRow label="Estado" value={getUserStatusLabel(user.status)} />
            <InfoRow label="Fecha de alta" value={formatDate(user.createdAt)} />
            <InfoRow
              label="Participando actualmente"
              value={participation ? "Sí" : "No"}
            />
            <InfoRow
              label="Observaciones internas"
              value={user.internalNotes || "Sin observaciones"}
            />
          </div>
        )}

        {tab === "access" && (
          <div className="space-y-4">
            <InfoRow label="Contraseña" value="••••••••" />
            <InfoRow label="Último cambio" value="Pendiente" />
            <InfoRow
              label="Último acceso"
              value={getLastLoginLabel(user.lastLogin)}
            />
            <button
              type="button"
              className="btn-primary"
              onClick={() => onResetPassword(user)}
            >
              <KeyRound className="h-4 w-4" />
              Restablecer contraseña
            </button>
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-500">
              Preparado para PIN, 2FA, sesiones, recuperación de contraseña e
              historial de acceso cuando se conecte Supabase Auth.
            </div>
          </div>
        )}

        {tab === "activity" && (
          <div className="space-y-4">
            {activities.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Pendiente de historial real.
              </p>
            ) : (
              <div className="space-y-3">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="rounded-lg border border-slate-200 p-3"
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {activity.label}
                    </p>
                    <p className="text-xs text-slate-500">
                      {activity.occurredAt}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <Link
              href={`/audit?user=${encodeURIComponent(user.displayName)}`}
              className="btn-secondary"
            >
              Ver auditoría
            </Link>
          </div>
        )}

        {tab === "stats" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <StatBox label="Depósitos" value={stats.deposits} />
            <StatBox label="Retiros" value={stats.withdrawals} />
            <StatBox label="Correcciones" value={stats.corrections} />
            <StatBox
              label="Turnos como responsable"
              value={stats.responsibleShifts}
            />
            <StatBox label="Turnos como apoyo" value={stats.supportShifts} />
          </div>
        )}
      </div>
    </aside>
  );
}

function UserFormPanel({
  isOpen,
  mode,
  step,
  form,
  message,
  onStepChange,
  onChange,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  mode: FormMode;
  step: 1 | 2;
  form: UserFormState;
  message: string | null;
  onStepChange: (step: 1 | 2) => void;
  onChange: (updates: Partial<UserFormState>) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/40 p-4">
      <div className="mx-auto flex min-h-full w-full max-w-3xl items-center">
        <div className="w-full rounded-xl bg-white shadow-xl">
          <header className="border-b border-slate-100 p-5">
            <p className="text-sm font-medium text-[#2563EB]">
              {mode === "create" ? "Alta de usuario" : "Edición de usuario"}
            </p>
            <h2 className="text-lg font-bold text-slate-950">
              {mode === "create" ? "Crear usuario" : "Editar usuario"}
            </h2>
          </header>

          <div className="p-5">
            <div className="mb-5 grid grid-cols-2 gap-2">
              <StepButton active={step === 1} onClick={() => onStepChange(1)}>
                1. Información personal
              </StepButton>
              <StepButton active={step === 2} onClick={() => onStepChange(2)}>
                2. Cuenta
              </StepButton>
            </div>

            {message && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                {message}
              </div>
            )}

            {step === 1 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  label="Nombre"
                  value={form.firstName}
                  onChange={(firstName) => onChange({ firstName })}
                />
                <TextField
                  label="Apellidos"
                  value={form.lastName}
                  onChange={(lastName) => onChange({ lastName })}
                />
                <SelectField
                  label="Rol"
                  value={form.systemRole}
                  onChange={(value) =>
                    onChange({ systemRole: value as UserAccount["systemRole"] })
                  }
                  options={[
                    { value: "owner", label: "Dueño" },
                    { value: "employee", label: "Empleado" },
                  ]}
                />
              </div>
            ) : (
              <div className="grid gap-4">
                <TextField
                  label="Usuario"
                  value={form.username}
                  onChange={(username) => onChange({ username })}
                />
                <TextField
                  label="Contraseña temporal"
                  value={form.temporaryPassword}
                  onChange={(temporaryPassword) =>
                    onChange({ temporaryPassword })
                  }
                  disabled={mode === "edit"}
                />
                <SelectField
                  label="Estado"
                  value={form.status}
                  onChange={(value) =>
                    onChange({ status: value as UserAccount["status"] })
                  }
                  options={[
                    { value: "active", label: "Activo" },
                    { value: "suspended", label: "Suspendido" },
                  ]}
                />
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Observaciones internas
                  </span>
                  <textarea
                    value={form.internalNotes}
                    onChange={(event) =>
                      onChange({ internalNotes: event.target.value })
                    }
                    rows={4}
                    className="field-input resize-none"
                  />
                </label>
              </div>
            )}
          </div>

          <footer className="flex flex-col gap-3 border-t border-slate-100 p-5 sm:flex-row sm:justify-end">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            {step === 1 ? (
              <button
                type="button"
                className="btn-primary"
                onClick={() => onStepChange(2)}
              >
                Continuar
              </button>
            ) : (
              <button type="button" className="btn-primary" onClick={onSubmit}>
                {mode === "create" ? "Crear usuario" : "Guardar cambios"}
              </button>
            )}
          </footer>
        </div>
      </div>
    </div>
  );
}

function ActionButtons({
  user,
  onView,
  onEdit,
  onStatusChange,
  onResetPassword,
}: {
  user: UserAccount;
  onView: () => void;
  onEdit: () => void;
  onStatusChange: () => void;
  onResetPassword: () => void;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <IconButton label="Ver" onClick={onView}>
        <Eye className="h-4 w-4" />
      </IconButton>
      <IconButton label="Editar" onClick={onEdit}>
        <Pencil className="h-4 w-4" />
      </IconButton>
      <IconButton label="Restablecer contraseña" onClick={onResetPassword}>
        <KeyRound className="h-4 w-4" />
      </IconButton>
      <IconButton
        label={user.status === "active" ? "Suspender" : "Reactivar"}
        onClick={onStatusChange}
        danger={user.status === "active"}
      >
        {user.status === "active" ? (
          <UserMinus className="h-4 w-4" />
        ) : (
          <RotateCcw className="h-4 w-4" />
        )}
      </IconButton>
    </div>
  );
}

function RoleBadge({ role }: { role: UserAccount["systemRole"] }) {
  const isOwner = role === "owner";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
        isOwner ? "bg-[#EFF6FF] text-[#2563EB]" : "bg-slate-100 text-slate-700"
      }`}
    >
      {isOwner && <ShieldCheck className="h-3.5 w-3.5" />}
      {getUserRoleLabel(role)}
    </span>
  );
}

function StatusBadge({ status }: { status: UserAccount["status"] }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        status === "active"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      {getUserStatusLabel(status)}
    </span>
  );
}

function IconButton({
  label,
  onClick,
  children,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`rounded-lg border p-2 transition ${
        danger
          ? "border-red-200 text-red-600 hover:bg-red-50"
          : "border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-slate-900">
        {value}
      </p>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      {value === null ? (
        <p className="mt-2 text-sm text-slate-500">
          Pendiente de datos históricos.
        </p>
      ) : (
        <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
      )}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      <input
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="field-input"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field-input"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function StepButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
        active
          ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function PasswordResultDialog({
  user,
  password,
  onClose,
}: {
  user: UserAccount;
  password: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-semibold text-slate-950">
            Contraseña temporal generada
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Copia esta contraseña y entrégala al usuario.
          </p>
        </div>
        <div className="p-5">
          <p className="text-sm font-medium text-slate-600">
            {user.displayName}
          </p>
          <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-lg font-bold text-slate-950">
            {password}
          </p>
        </div>
        <div className="flex justify-end border-t border-slate-100 p-5">
          <button type="button" className="btn-primary" onClick={onClose}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

function getConfirmTitle(confirmState: ConfirmState): string {
  if (!confirmState) return "";
  if (confirmState.type === "reset-password") return "Restablecer contraseña";
  if (confirmState.type === "suspend") return "Suspender usuario";
  return "Reactivar usuario";
}

function getConfirmDescription(confirmState: ConfirmState): string {
  if (!confirmState) return "";
  if (confirmState.type === "reset-password") {
    return `Se generará una contraseña temporal mock para ${confirmState.user.displayName}.`;
  }
  if (confirmState.type === "suspend") {
    return `La cuenta de ${confirmState.user.displayName} quedará suspendida. Su historial no se eliminará.`;
  }
  return `La cuenta de ${confirmState.user.displayName} volverá a estar activa.`;
}

function getConfirmLabel(confirmState: ConfirmState): string {
  if (!confirmState) return "Confirmar";
  if (confirmState.type === "reset-password") return "Restablecer";
  if (confirmState.type === "suspend") return "Suspender";
  return "Reactivar";
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
