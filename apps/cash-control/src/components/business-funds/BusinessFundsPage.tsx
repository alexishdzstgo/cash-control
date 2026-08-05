"use client";

import { Eye, Pencil, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useMockSession } from "@/components/session/MockSessionContext";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { SuccessDialog } from "@/components/shared/SuccessDialog";
import {
  centsToPesos,
  filterAdministrativeMovements,
  getAdministrativeMovementsSummary,
  getMovementTypeLabel,
  parseCurrencyToCents,
  validateAdministrativeWithdrawal,
} from "@/lib/administrativeMovements";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import type {
  AdministrativeMovement,
  AdministrativeMovementFilters,
  AdministrativeMovementType,
} from "@/types/administrativeMovement";
import { useBusinessFunds } from "./BusinessFundsContext";

type FormState = {
  mode: "create" | "edit";
  movementId?: string;
  movementType: AdministrativeMovementType;
  resourceId: string;
  amount: string;
  explanation: string;
  editReason: string;
};

const defaultFilters: AdministrativeMovementFilters = {
  search: "",
  movementType: "all",
  resourceId: "all",
  userName: "all",
  date: "",
};

export function BusinessFundsPage() {
  const { authenticatedUser, getContextResponsibleUserId } = useMockSession();
  const { movements, resources, registerMovement, correctMovement } =
    useBusinessFunds();
  const [filters, setFilters] =
    useState<AdministrativeMovementFilters>(defaultFilters);
  const [form, setForm] = useState<FormState | null>(null);
  const [detail, setDetail] = useState<AdministrativeMovement | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const summary = useMemo(
    () => getAdministrativeMovementsSummary(movements),
    [movements],
  );
  const filteredMovements = useMemo(
    () => filterAdministrativeMovements(movements, filters),
    [movements, filters],
  );
  const latestMovement = movements[0] ?? null;
  const users = Array.from(
    new Set(movements.map((movement) => movement.createdByUserName)),
  );
  const selectedResource = form
    ? resources.find((resource) => resource.id === form.resourceId)
    : undefined;
  const amountCents = form ? parseCurrencyToCents(form.amount) : null;
  const balanceAfterCents =
    selectedResource && form && amountCents !== null
      ? selectedResource.realBalanceCents +
        (form.movementType === "income" ? amountCents : -amountCents)
      : 0;

  function openCreateForm() {
    setFormError(null);
    setConfirming(false);
    setIsSubmitting(false);
    setForm({
      mode: "create",
      movementType: "income",
      resourceId: resources[0]?.id ?? "cash",
      amount: "",
      explanation: "",
      editReason: "",
    });
  }

  function openEditForm(movement: AdministrativeMovement) {
    setFormError(null);
    setConfirming(false);
    setIsSubmitting(false);
    setForm({
      mode: "edit",
      movementId: movement.id,
      movementType: movement.movementType,
      resourceId: movement.resourceId,
      amount: String(centsToPesos(movement.amountCents)),
      explanation: movement.explanation ?? "",
      editReason: "",
    });
  }

  function requestConfirm() {
    if (!form || !selectedResource) return;
    const parsedAmountCents = parseCurrencyToCents(form.amount);
    if (form.amount.trim() === "") {
      setFormError("El monto es obligatorio.");
      return;
    }
    if (parsedAmountCents === null) {
      setFormError("Ingresa un monto válido.");
      return;
    }
    const validation = validateAdministrativeWithdrawal({
      movementType: form.movementType,
      resource: selectedResource,
      amountCents: parsedAmountCents,
    });
    if (validation) {
      setFormError(validation);
      return;
    }
    if (form.mode === "edit" && !form.editReason.trim()) {
      setFormError("El motivo de corrección es obligatorio.");
      return;
    }
    setFormError(null);
    setConfirming(true);
  }

  function submitMovement() {
    if (isSubmitting || !form || !selectedResource || !authenticatedUser)
      return;
    const parsedAmountCents = parseCurrencyToCents(form.amount);
    if (parsedAmountCents === null) {
      setFormError("Ingresa un monto válido.");
      setConfirming(false);
      return;
    }
    setIsSubmitting(true);
    const actor = {
      userId: authenticatedUser.userId,
      userName: authenticatedUser.userName,
    };
    const result =
      form.mode === "create"
        ? registerMovement({
            movementType: form.movementType,
            resourceId: form.resourceId,
            amountCents: parsedAmountCents,
            explanation: form.explanation,
            createdByUserId: actor.userId,
            createdByUserName: actor.userName,
            shiftId: getContextResponsibleUserId()
              ? "shift-current"
              : undefined,
          })
        : correctMovement({
            movementId: form.movementId ?? "",
            movementType: form.movementType,
            resourceId: form.resourceId,
            amountCents: parsedAmountCents,
            explanation: form.explanation,
            editReason: form.editReason,
            editedByUserId: actor.userId,
            editedByUserName: actor.userName,
          });

    if (!result.success) {
      setFormError(result.error ?? "No fue posible registrar el movimiento.");
      setConfirming(false);
      setIsSubmitting(false);
      return;
    }

    setForm(null);
    setConfirming(false);
    setFormError(null);
    setIsSubmitting(false);
    setSuccessMessage(
      form.mode === "create"
        ? "Movimiento registrado correctamente."
        : "Movimiento corregido correctamente.",
    );
  }

  return (
    <div>
      <PageHeader
        title="Fondos del negocio"
        description="Registra los ingresos y retiros realizados por los dueños del negocio."
        action={
          <button
            type="button"
            className="btn-primary"
            onClick={openCreateForm}
          >
            <Plus className="h-4 w-4" />
            Nuevo movimiento
          </button>
        }
      />

      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Ingresos de hoy"
            value={summary.incomeTodayCents}
          />
          <SummaryCard
            label="Retiros de hoy"
            value={summary.withdrawalTodayCents}
          />
          <SummaryCard
            label="Balance neto administrativo"
            value={summary.netTodayCents}
          />
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Movimientos hoy
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-950">
              {summary.movementsToday}
            </p>
          </div>
        </section>

        {latestMovement && (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">
              Último movimiento
            </h2>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <Info
                label="Tipo"
                value={getMovementTypeLabel(latestMovement.movementType)}
              />
              <Info label="Recurso" value={latestMovement.resourceName} />
              <Info
                label="Monto"
                value={formatCents(latestMovement.amountCents)}
              />
              <Info label="Usuario" value={latestMovement.createdByUserName} />
              <Info
                label="Fecha"
                value={formatDateTime(latestMovement.createdAt)}
              />
            </div>
            {latestMovement.explanation && (
              <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                “{latestMovement.explanation}”
              </p>
            )}
          </section>
        )}

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
            <input
              className="field-input"
              placeholder="Buscar en explicación, recurso o usuario"
              value={filters.search}
              onChange={(event) =>
                setFilters({ ...filters, search: event.target.value })
              }
            />
            <Select
              value={filters.movementType}
              onChange={(movementType) =>
                setFilters({
                  ...filters,
                  movementType:
                    movementType as AdministrativeMovementFilters["movementType"],
                })
              }
              options={[
                ["all", "Tipo"],
                ["income", "Ingreso"],
                ["withdrawal", "Retiro"],
              ]}
            />
            <Select
              value={filters.resourceId}
              onChange={(resourceId) => setFilters({ ...filters, resourceId })}
              options={[
                ["all", "Recurso"],
                ...resources.map(
                  (resource) => [resource.id, resource.name] as const,
                ),
              ]}
            />
            <Select
              value={filters.userName}
              onChange={(userName) => setFilters({ ...filters, userName })}
              options={[
                ["all", "Usuario"],
                ...users.map((user) => [user, user] as const),
              ]}
            />
            <input
              className="field-input"
              type="date"
              value={filters.date}
              onChange={(event) =>
                setFilters({ ...filters, date: event.target.value })
              }
            />
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Fecha y hora</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Recurso</th>
                  <th className="px-4 py-3">Monto</th>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Explicación</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMovements.map((movement) => (
                  <MovementRow
                    key={movement.id}
                    movement={movement}
                    onView={() => setDetail(movement)}
                    onEdit={() => openEditForm(movement)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-slate-100 lg:hidden">
            {filteredMovements.map((movement) => (
              <div key={movement.id} className="p-4">
                <MovementCard
                  movement={movement}
                  onView={() => setDetail(movement)}
                  onEdit={() => openEditForm(movement)}
                />
              </div>
            ))}
          </div>
          {filteredMovements.length === 0 && (
            <p className="p-8 text-center text-sm text-slate-500">
              No se encontraron movimientos administrativos con los filtros
              seleccionados.
            </p>
          )}
        </section>

        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          Los movimientos de esta versión de demostración no se conservarán al
          recargar.
        </p>
      </div>

      {form && selectedResource && !confirming && (
        <MovementForm
          form={form}
          formError={formError}
          resourceAvailable={selectedResource.availableCents}
          onChange={(updates) =>
            setForm((current) => {
              setFormError(null);
              return current ? { ...current, ...updates } : current;
            })
          }
          resources={resources}
          onClose={() => setForm(null)}
          onSubmit={requestConfirm}
        />
      )}

      <ConfirmDialog
        isOpen={confirming && Boolean(form && selectedResource)}
        title={
          form?.movementType === "income"
            ? "Registrar ingreso"
            : "Registrar retiro"
        }
        description={
          form && selectedResource && amountCents !== null
            ? `${form.movementType === "income" ? "Se agregarán" : "Se retirarán"} ${formatCents(amountCents)} ${form.movementType === "income" ? "a" : "de"} ${selectedResource.name}. Saldo antes: ${formatCents(selectedResource.realBalanceCents)}. Saldo después: ${formatCents(balanceAfterCents)}.${form.explanation.trim() ? ` Explicación: ${form.explanation.trim()}.` : ""}`
            : ""
        }
        confirmLabel="Confirmar movimiento"
        cancelLabel="Volver"
        onConfirm={submitMovement}
        onCancel={() => {
          setConfirming(false);
          setIsSubmitting(false);
        }}
        isConfirmDisabled={isSubmitting}
      />

      {detail && (
        <MovementDetail movement={detail} onClose={() => setDetail(null)} />
      )}

      <SuccessDialog
        isOpen={successMessage !== null}
        title="Fondos del negocio"
        description={successMessage ?? ""}
        buttonLabel="Continuar"
        onClose={() => setSuccessMessage(null)}
      />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950">
        {formatCents(value)}
      </p>
    </div>
  );
}

function MovementRow({
  movement,
  onView,
  onEdit,
}: {
  movement: AdministrativeMovement;
  onView: () => void;
  onEdit: () => void;
}) {
  return (
    <tr>
      <td className="px-4 py-4 text-slate-600">
        {formatDateTime(movement.createdAt)}
      </td>
      <td className="px-4 py-4">
        <MovementTypeBadge type={movement.movementType} />
      </td>
      <td className="px-4 py-4 font-semibold text-slate-900">
        {movement.resourceName}
      </td>
      <td className="px-4 py-4 font-semibold tabular-nums">
        {formatCents(movement.amountCents)}
      </td>
      <td className="px-4 py-4 text-slate-600">{movement.createdByUserName}</td>
      <td className="max-w-xs truncate px-4 py-4 text-slate-600">
        {movement.explanation ?? "Sin explicación"}
      </td>
      <td className="px-4 py-4">
        <StatusBadge movement={movement} />
      </td>
      <td className="px-4 py-4">
        <div className="flex justify-end gap-2">
          <IconButton label="Ver detalle" onClick={onView}>
            <Eye className="h-4 w-4" />
          </IconButton>
          <IconButton label="Corregir" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </IconButton>
        </div>
      </td>
    </tr>
  );
}

function MovementCard(props: {
  movement: AdministrativeMovement;
  onView: () => void;
  onEdit: () => void;
}) {
  const { movement, onView, onEdit } = props;
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <MovementTypeBadge type={movement.movementType} />
          <p className="mt-2 font-semibold text-slate-950">
            {movement.resourceName}
          </p>
          <p className="text-sm text-slate-500">
            {formatDateTime(movement.createdAt)}
          </p>
        </div>
        <p className="font-bold text-slate-950">
          {formatCents(movement.amountCents)}
        </p>
      </div>
      <p className="mt-3 text-sm text-slate-600">
        {movement.explanation ?? "Sin explicación"}
      </p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <StatusBadge movement={movement} />
        <div className="flex gap-2">
          <IconButton label="Ver detalle" onClick={onView}>
            <Eye className="h-4 w-4" />
          </IconButton>
          <IconButton label="Corregir" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </IconButton>
        </div>
      </div>
    </div>
  );
}

function MovementForm({
  form,
  formError,
  resources,
  resourceAvailable,
  onChange,
  onClose,
  onSubmit,
}: {
  form: FormState;
  formError: string | null;
  resources: Array<{ id: string; name: string; availableCents: number }>;
  resourceAvailable: number;
  onChange: (updates: Partial<FormState>) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/40 p-4">
      <div className="mx-auto flex min-h-full w-full max-w-2xl items-center">
        <div className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-xl bg-white shadow-xl">
          <header className="border-b border-slate-100 p-5">
            <p className="text-sm font-medium text-[#2563EB]">
              Fondos del negocio
            </p>
            <h2 className="text-lg font-bold text-slate-950">
              {form.mode === "create"
                ? "Nuevo movimiento de fondos"
                : "Corregir movimiento de fondos"}
            </h2>
          </header>
          <div className="scrollbar-hidden min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            <div className="grid grid-cols-2 gap-2">
              {(["income", "withdrawal"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                    form.movementType === type
                      ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]"
                      : "border-slate-200 text-slate-600"
                  }`}
                  onClick={() => onChange({ movementType: type })}
                >
                  {getMovementTypeLabel(type)}
                </button>
              ))}
            </div>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Recurso
              </span>
              <select
                className="field-input"
                value={form.resourceId}
                onChange={(event) =>
                  onChange({ resourceId: event.target.value })
                }
              >
                {resources.map((resource) => (
                  <option key={resource.id} value={resource.id}>
                    {resource.name}
                  </option>
                ))}
              </select>
              <span className="mt-2 block text-sm text-slate-500">
                Disponible actual: {formatCents(resourceAvailable)}
              </span>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Monto
              </span>
              <input
                className="field-input"
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(event) => onChange({ amount: event.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Explicación
              </span>
              <textarea
                className="field-input resize-none"
                rows={3}
                value={form.explanation}
                onChange={(event) =>
                  onChange({ explanation: event.target.value })
                }
              />
              <span className="mt-2 block text-sm text-slate-500">
                Agrega una referencia breve para facilitar futuras consultas.
              </span>
              {!form.explanation.trim() && (
                <span className="mt-1 block text-sm text-amber-700">
                  Se recomienda agregar una explicación para facilitar la
                  auditoría.
                </span>
              )}
            </label>
            {form.mode === "edit" && (
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Motivo de corrección
                </span>
                <textarea
                  className="field-input resize-none"
                  rows={3}
                  value={form.editReason}
                  onChange={(event) =>
                    onChange({ editReason: event.target.value })
                  }
                />
              </label>
            )}
          </div>
          {formError && (
            <div className="border-t border-red-100 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700">
              {formError}
            </div>
          )}
          <footer className="flex justify-end gap-3 border-t border-slate-100 p-5">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={onSubmit}>
              Registrar movimiento
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}

function MovementDetail({
  movement,
  onClose,
}: {
  movement: AdministrativeMovement;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <header className="border-b border-slate-100 p-5">
          <h2 className="text-lg font-bold text-slate-950">
            Detalle del movimiento
          </h2>
        </header>
        <div className="grid gap-3 p-5 md:grid-cols-2">
          <Info label="ID" value={movement.id} />
          <Info
            label="Tipo"
            value={getMovementTypeLabel(movement.movementType)}
          />
          <Info label="Recurso" value={movement.resourceName} />
          <Info label="Monto" value={formatCents(movement.amountCents)} />
          <Info
            label="Saldo anterior"
            value={formatCents(movement.balanceBeforeCents)}
          />
          <Info
            label="Saldo posterior"
            value={formatCents(movement.balanceAfterCents)}
          />
          <Info label="Usuario" value={movement.createdByUserName} />
          <Info
            label="Fecha y hora"
            value={formatDateTime(movement.createdAt)}
          />
          <Info
            label="Turno"
            value={movement.shiftId ?? "Sin turno asociado"}
          />
          <Info
            label="Indicador de corrección"
            value={movement.isEdited ? "Corregido" : "Sin corrección"}
          />
          <div className="md:col-span-2">
            <Info
              label="Explicación"
              value={movement.explanation ?? "Sin explicación"}
            />
          </div>
          {movement.editReason && (
            <div className="md:col-span-2">
              <Info label="Motivo de corrección" value={movement.editReason} />
            </div>
          )}
        </div>
        <footer className="flex justify-end border-t border-slate-100 p-5">
          <button type="button" className="btn-primary" onClick={onClose}>
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
}

function MovementTypeBadge({ type }: { type: AdministrativeMovementType }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        type === "income"
          ? "bg-[#EFF6FF] text-[#2563EB]"
          : "bg-slate-100 text-slate-700"
      }`}
    >
      {getMovementTypeLabel(type)}
    </span>
  );
}

function StatusBadge({ movement }: { movement: AdministrativeMovement }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        movement.status === "corrected"
          ? "bg-amber-50 text-amber-700"
          : "bg-slate-100 text-slate-700"
      }`}
    >
      {movement.status === "corrected" ? "Corregido" : "Registrado"}
    </span>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
    >
      {children}
    </button>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <select
      className="field-input"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  );
}

function formatCents(value: number): string {
  return formatCurrency(centsToPesos(value));
}
