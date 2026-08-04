import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/commission";
import type { CommissionRule } from "@/types/commission";

type CommissionRulesTableProps = {
  rules: CommissionRule[];
  onEdit: (rule: CommissionRule) => void;
  onReplace: (rule: CommissionRule) => void;
  onDeactivate: (rule: CommissionRule) => void;
  onDelete: (rule: CommissionRule) => void;
  onView: (rule: CommissionRule) => void;
};

export function CommissionRulesTable({
  rules,
  onEdit,
  onReplace,
  onDeactivate,
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
            {sortedRules.map((rule) => (
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
                  <Badge
                    variant={
                      rule.status === "active"
                        ? "success"
                        : rule.status === "inactive"
                          ? "neutral"
                          : "alert"
                    }
                  >
                    {rule.status === "active"
                      ? "Activa"
                      : rule.status === "inactive"
                        ? "Inactiva"
                        : rule.status === "scheduled"
                          ? "Programada"
                          : "Expirada"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-slate-600">v{rule.version}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <ActionButton onClick={() => onView(rule)}>Ver</ActionButton>
                    <ActionButton onClick={() => onEdit(rule)}>Editar</ActionButton>
                    <ActionButton onClick={() => onReplace(rule)}>
                      Reemplazar
                    </ActionButton>
                    {rule.status === "active" && (
                      <ActionButton onClick={() => onDeactivate(rule)}>
                        Desactivar
                      </ActionButton>
                    )}
                    {!rule.hasBeenApplied && (
                      <ActionButton danger onClick={() => onDelete(rule)}>
                        Eliminar
                      </ActionButton>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ActionButton({
  children,
  danger = false,
  onClick,
}: {
  children: React.ReactNode;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-8 items-center rounded-lg border px-3 text-xs font-semibold transition ${
        danger
          ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}
