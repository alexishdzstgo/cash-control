"use client";

import { Eye, Pencil, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useMockSession } from "@/components/session/MockSessionContext";
import { AmountField } from "@/components/shared/AmountField";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { SuccessDialog } from "@/components/shared/SuccessDialog";
import {
  centsToPesos,
  filterAdministrativeMovements,
  getAdministrativeMovementsSummary,
  getMovementTypeLabel,
  parseCurrencyToCents,
} from "@/lib/administrativeMovements";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import type {
  AdministrativeMovement,
  AdministrativeMovementFilters,
  AdministrativeMovementType,
  AdministrativeResource,
} from "@/types/administrativeMovement";
import { useBusinessFunds } from "./BusinessFundsContext";

type FormState = {
  mode: "create" | "edit";
  movementId?: string;
  movementType: AdministrativeMovementType | "";
  resourceId: string;
  amount: string;
  explanation: string;
  editReason: string;
};

type FormErrors = Partial<
  Record<
    "movementType" | "resourceId" | "amount" | "explanation" | "editReason",
    string
  >
>;

const defaultFilters: AdministrativeMovementFilters = {
  search: "",
  movementType: "all",
  resourceId: "all",
  userName: "all",
  date: "",
};

export function BusinessFundsPage() {
  const {
    authenticatedUser,
    getActiveParticipation,
    getContextResponsibleUserId,
  } = useMockSession();
  const { movements, resources, registerMovement, correctMovement } =
    useBusinessFunds();
  const [filters, setFilters] =
    useState<AdministrativeMovementFilters>(defaultFilters);
  const [form, setForm] = useState<FormState | null>(null);
  const [detail, setDetail] = useState<AdministrativeMovement | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOwner = authenticatedUser?.systemRole === "owner";
  const isEmployee = authenticatedUser?.systemRole === "employee";
  const activeParticipation = authenticatedUser
    ? getActiveParticipation(authenticatedUser.userId)
    : undefined;
  const canCreateMovement = isOwner || Boolean(activeParticipation);
  const canCorrectMovements = isOwner;

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
  const previewBalanceAfterCents =
    selectedResource &&
    form &&
    isAdministrativeMovementType(form.movementType) &&
    amountCents !== null
      ? selectedResource.availableCents +
        (form.movementType === "income" ? amountCents : -amountCents)
      : null;
  const confirmationDescription =
    form &&
    selectedResource &&
    isAdministrativeMovementType(form.movementType) &&
    amountCents !== null &&
    previewBalanceAfterCents !== null
      ? getMovementConfirmationDescription({
          movementType: form.movementType,
          resource: selectedResource,
          amountCents,
          explanation: form.explanation,
          balanceAfterCents: previewBalanceAfterCents,
        })
      : "";

  if (!authenticatedUser) {
    return null;
  }

  function openCreateForm() {
    if (!canCreateMovement) {
      setFormError(
        "Activa tu participacion para registrar movimientos de fondos.",
      );
      return;
    }

    setFormError(null);
    setFormErrors({});
    setConfirming(false);
    setIsSubmitting(false);
    setForm({
      mode: "create",
      movementType: "",
      resourceId: "",
      amount: "",
      explanation: "",
      editReason: "",
    });
  }

  function openEditForm(movement: AdministrativeMovement) {
    if (!canCorrectMovements) {
      return;
    }

    setFormError(null);
    setFormErrors({});
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
    if (!form) return;

    const validation = validateForm({
      form,
      selectedResource,
      amountCents,
      canCreateMovement,
    });

    setFormErrors(validation.errors);
    setFormError(validation.formError);

    if (!validation.isValid) {
      return;
    }

    setConfirming(true);
  }

  function submitMovement() {
    if (
      isSubmitting ||
      !form ||
      !selectedResource ||
      !isAdministrativeMovementType(form.movementType) ||
      !authenticatedUser
    ) {
      return;
    }

    const parsedAmountCents = parseCurrencyToCents(form.amount);
    if (parsedAmountCents === null) {
      setFormErrors({ amount: "Ingresa un monto valido." });
      setFormError(null);
      setConfirming(false);
      return;
    }

    if (form.mode === "edit" && !canCorrectMovements) {
      setFormError("Solo el owner puede corregir movimientos de fondos.");
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
      setFormError(
        result.error?.includes("fondos disponibles")
          ? "El recurso seleccionado no tiene fondos suficientes."
          : (result.error ?? "No fue posible registrar el movimiento."),
      );
      setConfirming(false);
      setIsSubmitting(false);
      return;
    }

    setForm(null);
    setConfirming(false);
    setFormError(null);
    setFormErrors({});
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
        description={
          isEmployee
            ? "Registra entradas o salidas de dinero que no corresponden a depositos o retiros de clientes."
            : "Registra los ingresos y retiros internos realizados con fondos del negocio."
        }
        action={
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <button
              type="button"
              className="btn-primary"
              onClick={openCreateForm}
              disabled={!canCreateMovement}
            >
              <Plus className="h-4 w-4" />
              Nuevo movimiento
            </button>
            {!canCreateMovement && (
              <p className="max-w-xs text-sm font-medium text-amber-700">
                Activa tu participacion para registrar movimientos de fondos.
              </p>
            )}
          </div>
        }
      />

      <div className="space-y-6">
        {isOwner && (
          <>
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
                  Ultimo movimiento
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
                  <Info
                    label="Realizado por"
                    value={latestMovement.createdByUserName}
                  />
                  <Info
                    label="Fecha"
                    value={formatDateTime(latestMovement.createdAt)}
                  />
                </div>
                {latestMovement.explanation && (
                  <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                    "{latestMovement.explanation}"
                  </p>
                )}
              </section>
            )}
          </>
        )}

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
            <input
              className="field-input"
              placeholder="Buscar por motivo, recurso o usuario"
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
                ["all", "Realizado por"],
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
                  <th className="px-4 py-3">Realizado por</th>
                  <th className="px-4 py-3">Motivo</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMovements.map((movement) => (
                  <MovementRow
                    key={movement.id}
                    movement={movement}
                    canEdit={canCorrectMovements}
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
                  canEdit={canCorrectMovements}
                  onView={() => setDetail(movement)}
                  onEdit={() => openEditForm(movement)}
                />
              </div>
            ))}
          </div>
          {filteredMovements.length === 0 && (
            <p className="p-8 text-center text-sm text-slate-500">
              No se encontraron movimientos de fondos con los filtros
              seleccionados.
            </p>
          )}
        </section>

        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          Los movimientos de fondos son internos: no se contabilizan
          automaticamente como ganancia, deposito de cliente, retiro de cliente
          ni comision.
        </p>
      </div>

      {form && !confirming && (
        <MovementForm
          form={form}
          formError={formError}
          formErrors={formErrors}
          resources={resources}
          selectedResource={selectedResource}
          balanceAfterCents={previewBalanceAfterCents}
          onChange={(updates) =>
            setForm((current) => {
              setFormError(null);
              setFormErrors({});
              return current ? { ...current, ...updates } : current;
            })
          }
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
          confirmationDescription
        }
        confirmLabel="Registrar movimiento"
        cancelLabel="Cancelar"
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

function validateForm({
  form,
  selectedResource,
  amountCents,
  canCreateMovement,
}: {
  form: FormState;
  selectedResource: AdministrativeResource | undefined;
  amountCents: number | null;
  canCreateMovement: boolean;
}): { isValid: boolean; errors: FormErrors; formError: string | null } {
  const errors: FormErrors = {};
  let formError: string | null = null;

  if (form.mode === "create" && !canCreateMovement) {
    formError = "Activa tu participacion para registrar movimientos de fondos.";
  }
  if (!isAdministrativeMovementType(form.movementType)) {
    errors.movementType = "Selecciona el tipo de movimiento.";
  }
  if (!selectedResource) {
    errors.resourceId = "Selecciona el recurso.";
  }
  if (form.amount.trim() === "") {
    errors.amount = "El monto es obligatorio.";
  } else if (amountCents === null) {
    errors.amount = "Ingresa un monto valido.";
  } else if (amountCents <= 0) {
    errors.amount = "El monto debe ser mayor que cero.";
  }
  if (!form.explanation.trim()) {
    errors.explanation = "Indica el motivo del movimiento.";
  }
  if (form.mode === "edit" && !form.editReason.trim()) {
    errors.editReason = "El motivo de correccion es obligatorio.";
  }
  if (
    selectedResource &&
    amountCents !== null &&
    isAdministrativeMovementType(form.movementType) &&
    form.movementType === "withdrawal" &&
    amountCents > selectedResource.availableCents
  ) {
    errors.amount = "El recurso seleccionado no tiene fondos suficientes.";
  }

  return {
    isValid: Object.keys(errors).length === 0 && formError === null,
    errors,
    formError,
  };
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
  canEdit,
  onView,
  onEdit,
}: {
  movement: AdministrativeMovement;
  canEdit: boolean;
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
        {movement.explanation ?? "Sin motivo"}
      </td>
      <td className="px-4 py-4">
        <StatusBadge movement={movement} />
      </td>
      <td className="px-4 py-4">
        <div className="flex justify-end gap-2">
          <IconButton label="Ver detalle" onClick={onView}>
            <Eye className="h-4 w-4" />
          </IconButton>
          {canEdit && (
            <IconButton label="Corregir" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </IconButton>
          )}
        </div>
      </td>
    </tr>
  );
}

function MovementCard({
  movement,
  canEdit,
  onView,
  onEdit,
}: {
  movement: AdministrativeMovement;
  canEdit: boolean;
  onView: () => void;
  onEdit: () => void;
}) {
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
        {movement.explanation ?? "Sin motivo"}
      </p>
      <p className="mt-2 text-sm text-slate-500">
        Realizado por:{" "}
        <span className="font-semibold text-slate-700">
          {movement.createdByUserName}
        </span>
      </p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <StatusBadge movement={movement} />
        <div className="flex gap-2">
          <IconButton label="Ver detalle" onClick={onView}>
            <Eye className="h-4 w-4" />
          </IconButton>
          {canEdit && (
            <IconButton label="Corregir" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </IconButton>
          )}
        </div>
      </div>
    </div>
  );
}

function MovementForm({
  form,
  formError,
  formErrors,
  resources,
  selectedResource,
  balanceAfterCents,
  onChange,
  onClose,
  onSubmit,
}: {
  form: FormState;
  formError: string | null;
  formErrors: FormErrors;
  resources: AdministrativeResource[];
  selectedResource: AdministrativeResource | undefined;
  balanceAfterCents: number | null;
  onChange: (updates: Partial<FormState>) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const resourceBalanceAfterIsNegative =
    balanceAfterCents !== null && balanceAfterCents < 0;

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/40 p-4">
      <div className="mx-auto flex min-h-full w-full max-w-2xl items-center">
        <div className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-xl bg-white shadow-xl">
          <header className="border-b border-slate-100 p-5">
            <h2 className="text-lg font-bold text-slate-950">
              {form.mode === "create"
                ? "Nuevo movimiento de fondos"
                : "Corregir movimiento de fondos"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Registra una entrada o salida de dinero del negocio.
            </p>
          </header>
          <div className="scrollbar-hidden min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            <fieldset>
              <legend className="mb-2 block text-sm font-semibold text-slate-700">
                Tipo de movimiento
                <RequiredMark />
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {(["income", "withdrawal"] as const).map((type) => {
                  const isSelected = form.movementType === type;
                  const selectedClass =
                    type === "income"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-rose-200 bg-rose-50 text-rose-800";

                  return (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={isSelected}
                      className={`min-h-11 cursor-pointer rounded-lg border px-3 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
                        isSelected
                          ? selectedClass
                          : "border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50"
                      }`}
                      onClick={() => onChange({ movementType: type })}
                    >
                      {getMovementTypeLabel(type)}
                    </button>
                  );
                })}
              </div>
              {formErrors.movementType && (
                <FieldError message={formErrors.movementType} />
              )}
            </fieldset>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Recurso
                <RequiredMark />
              </span>
              <select
                className="field-input"
                value={form.resourceId}
                onChange={(event) =>
                  onChange({ resourceId: event.target.value })
                }
              >
                <option value="">Selecciona un recurso</option>
                {resources.map((resource) => (
                  <option key={resource.id} value={resource.id}>
                    {resource.name}
                  </option>
                ))}
              </select>
              {formErrors.resourceId && (
                <FieldError message={formErrors.resourceId} />
              )}
            </label>

            <AmountField
              id="business-funds-amount"
              value={form.amount}
              onChange={(amount) => onChange({ amount })}
              label="Monto"
              placeholder="0.00"
              required
              min={0}
              step={0.01}
              error={formErrors.amount}
            />

            <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
              <Info
                label="Disponible actual"
                value={
                  selectedResource
                    ? formatCents(selectedResource.availableCents)
                    : "Selecciona un recurso"
                }
              />
              <Info
                label="Despues del movimiento"
                value={
                  balanceAfterCents === null
                    ? "Pendiente"
                    : formatCents(balanceAfterCents)
                }
              />
              {resourceBalanceAfterIsNegative && (
                <p className="sm:col-span-2 text-sm font-semibold text-red-700">
                  El recurso seleccionado no tiene fondos suficientes.
                </p>
              )}
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Motivo del movimiento
                <RequiredMark />
              </span>
              <textarea
                className="field-input resize-none"
                rows={3}
                value={form.explanation}
                placeholder="Describe brevemente por que aumenta o disminuye este saldo"
                onChange={(event) =>
                  onChange({ explanation: event.target.value })
                }
              />
              {formErrors.explanation ? (
                <FieldError message={formErrors.explanation} />
              ) : (
                <span className="mt-2 block text-sm text-slate-500">
                  Este texto queda visible para auditoria y consultas futuras.
                </span>
              )}
            </label>

            {form.mode === "edit" && (
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Motivo de correccion
                  <RequiredMark />
                </span>
                <textarea
                  className="field-input resize-none"
                  rows={3}
                  value={form.editReason}
                  onChange={(event) =>
                    onChange({ editReason: event.target.value })
                  }
                />
                {formErrors.editReason && (
                  <FieldError message={formErrors.editReason} />
                )}
              </label>
            )}
          </div>
          {formError && (
            <div className="border-t border-red-100 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700">
              {formError}
            </div>
          )}
          <footer className="flex flex-col-reverse gap-3 border-t border-slate-100 p-5 sm:flex-row sm:justify-end">
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
          <Info label="Realizado por" value={movement.createdByUserName} />
          <Info
            label="Fecha y hora"
            value={formatDateTime(movement.createdAt)}
          />
          <Info
            label="Turno"
            value={movement.shiftId ?? "Sin turno asociado"}
          />
          <Info
            label="Indicador de correccion"
            value={movement.isEdited ? "Corregido" : "Sin correccion"}
          />
          <div className="md:col-span-2">
            <Info label="Motivo" value={movement.explanation ?? "Sin motivo"} />
          </div>
          {movement.editReason && (
            <div className="md:col-span-2">
              <Info label="Motivo de correccion" value={movement.editReason} />
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

function RequiredMark() {
  return <span className="ml-1 text-red-500">*</span>;
}

function FieldError({ message }: { message: string }) {
  return <p className="mt-2 text-sm font-medium text-red-600">{message}</p>;
}

function getMovementConfirmationDescription({
  movementType,
  resource,
  amountCents,
  explanation,
  balanceAfterCents,
}: {
  movementType: AdministrativeMovementType;
  resource: AdministrativeResource;
  amountCents: number;
  explanation: string;
  balanceAfterCents: number;
}): string {
  const currentBalanceLabel =
    resource.type === "cash" ? "Disponible actualmente" : "Saldo actual";
  const reservedDetail =
    resource.type === "cash" && resource.reservedCents > 0
      ? ` Hay ${formatCents(resource.reservedCents)} separados para retiros pendientes.`
      : "";

  return `${getMovementTypeLabel(movementType)} en ${resource.name}. Monto: ${formatCents(amountCents)}. Motivo: ${explanation.trim()}. ${currentBalanceLabel}: ${formatCents(resource.availableCents)}. Saldo despues: ${formatCents(balanceAfterCents)}.${reservedDetail}`;
}

function formatCents(value: number): string {
  return formatCurrency(centsToPesos(value));
}

function isAdministrativeMovementType(
  value: FormState["movementType"],
): value is AdministrativeMovementType {
  return value === "income" || value === "withdrawal";
}
