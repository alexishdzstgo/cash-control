import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/commission";
import type { CommissionRule } from "@/types/commission";

type CommissionRulesTableProps = {
  rules: CommissionRule[];
  onEdit: (rule: CommissionRule) => void;
  onReplace: (rule: CommissionRule) => void;
  onDeactivate: (rule: CommissionRule) => void;
  onActivate: (rule: CommissionRule) => void;
  onDelete: (rule: CommissionRule) => void;
  onView: (rule: CommissionRule) => void;
};

export function CommissionRulesTable({
  rules,
  onEdit,
  onReplace,
  onDeactivate,
  onActivate,
  onDelete,
  onView,
}: CommissionRulesTableProps) {
  const sortedRules = [...rules].sort(
    (first, second) =>
      first.minAmountCents - second.minAmountCents ||
      second.version - first.version,
  );

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Desde</th>
              <th className="px-4 py-3">Hasta</th>
              <th className="px-4 py-3">Comisión</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Versión</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedRules.map((rule) => {
              const cannotDelete = rule.hasBeenApplied || Boolean(rule.replacedByRuleId);
              const deleteReason = rule.hasBeenApplied
                ? "Esta regla ya fue aplicada a operaciones y debe conservarse para mantener el historial."
                : "Esta regla forma parte del histórico de versiones y no puede eliminarse.";

              return (
              <tr key={rule.id} className="bg-white hover:bg-slate-50/70">
                <td className="px-4 py-3 font-semibold tabular-nums text-slate-900">
                  {formatCents(rule.minAmountCents)}
                </td>
                <td className="px-4 py-3 font-semibold tabular-nums text-slate-900">
                  {rule.maxAmountCents === null
                    ? "Sin límite"
                    : formatCents(rule.maxAmountCents)}
                </td>
                <td className="px-4 py-3 font-semibold tabular-nums text-slate-900">
                  {formatCents(rule.fixedAmountCents)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge rule={rule} />
                    {rule.replacedByRuleId && (
                      <Badge variant="alert">Reemplazada</Badge>
                    )}
                    {rule.hasBeenApplied && <Badge variant="info">Utilizada</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">v{rule.version}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <ActionButton tone="secondary" onClick={() => onView(rule)}>
                      Ver detalle
                    </ActionButton>

                    {!rule.hasBeenApplied && (
                      <ActionButton tone="secondary" onClick={() => onEdit(rule)}>
                        Editar
                      </ActionButton>
                    )}

                    {rule.hasBeenApplied && rule.status === "active" && (
                      <ActionButton tone="secondary" onClick={() => onReplace(rule)}>
                        Reemplazar
                      </ActionButton>
                    )}

                    {rule.status === "active" && (
                      <ActionButton tone="warning" onClick={() => onDeactivate(rule)}>
                        Desactivar
                      </ActionButton>
                    )}

                    {rule.status === "inactive" && !rule.hasBeenApplied && (
                      <ActionButton tone="success" onClick={() => onActivate(rule)}>
                        Activar
                      </ActionButton>
                    )}

                    {cannotDelete ? (
                      <ActionButton
                        tone="disabled"
                        title={deleteReason}
                        onClick={() => undefined}
                      >
                        Eliminar
                        <span className="ml-1 font-normal">No disponible</span>
                      </ActionButton>
                    ) : (
                      <ActionButton tone="destructive" onClick={() => onDelete(rule)}>
                        Eliminar
                      </ActionButton>
                    )}
                  </div>
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ActionButton({
  children,
  tone,
  title,
  onClick,
}: {
  children: React.ReactNode;
  tone: "secondary" | "warning" | "success" | "destructive" | "disabled";
  title?: string;
  onClick: () => void;
}) {
  const disabled = tone === "disabled";
  const toneClass = {
    secondary:
      "border-[#CBD5E1] bg-white text-[#334155] hover:bg-[#F1F5F9]",
    warning:
      "border-[#F59E0B] bg-[#FFFBEB] text-[#B45309] hover:bg-[#FEF3C7]",
    success:
      "border-[#16A34A] bg-emerald-50 text-[#15803D] hover:bg-emerald-100",
    destructive:
      "border-[#DC2626] bg-[#DC2626] text-white hover:bg-[#B91C1C]",
    disabled:
      "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400",
  }[tone];

  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={`inline-flex min-h-8 items-center rounded-lg border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#93C5FD] focus-visible:ring-offset-2 ${toneClass}`}
    >
      {children}
    </button>
  );
}

function StatusBadge({ rule }: { rule: CommissionRule }) {
  if (rule.status === "active") {
    return <Badge variant="success">Activa</Badge>;
  }
  if (rule.status === "scheduled") {
    return <Badge variant="info">Programada</Badge>;
  }
  if (rule.status === "expired") {
    return <Badge variant="neutral" className="bg-slate-200 text-slate-800">Vencida</Badge>;
  }
  return <Badge variant="neutral">Inactiva</Badge>;
}
