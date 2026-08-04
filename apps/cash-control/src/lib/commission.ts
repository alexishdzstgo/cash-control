import type {
  CommissionCalculation,
  CommissionOperationType,
  CommissionRule,
} from "@/types/commission";
import type { Operation } from "@/types/operation";

export const NO_COMMISSION_RULE_MESSAGE =
  "No hay una comisión configurada para este monto. Solicita al dueño agregar el rango correspondiente.";

export type CalculateCommissionInput = {
  amountCents: number;
  operationType: CommissionOperationType;
  rules: CommissionRule[];
  effectiveAt?: string | Date;
};

export type CommissionValidationIssue = {
  code:
    | "overlap"
    | "gap"
    | "inverted_range"
    | "duplicate"
    | "negative_commission"
    | "open_range_limit"
    | "zero_commission_requires_reason";
  message: string;
  ruleId?: string;
};

export type CommissionCoverageWarning = {
  code: "coverage_before_first" | "coverage_after_last";
  message: string;
  operationType: CommissionOperationType;
};

export type CommissionValidationResult = {
  errors: CommissionValidationIssue[];
  warnings: CommissionCoverageWarning[];
};

export type CommissionRuleCandidate = Omit<
  CommissionRule,
  "id" | "version" | "validFrom" | "createdBy"
> & {
  id?: string;
  version?: number;
  validFrom?: string;
  createdBy?: string;
  zeroCommissionReason?: string;
};

export function calculateCommission({
  amountCents,
  operationType,
  rules,
  effectiveAt = new Date(),
}: CalculateCommissionInput): CommissionCalculation | null {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return null;
  }

  const effectiveDate =
    effectiveAt instanceof Date ? effectiveAt : new Date(effectiveAt);

  const matchingRules = rules.filter((rule) => {
    if (rule.status !== "active") return false;
    if (rule.operationType !== operationType) return false;
    if (!isRuleEffective(rule, effectiveDate)) return false;
    if (amountCents < rule.minAmountCents) return false;
    if (rule.maxAmountCents !== null && amountCents > rule.maxAmountCents) {
      return false;
    }

    return true;
  });

  if (matchingRules.length > 1) {
    throw new Error("La configuración de comisiones tiene rangos traslapados.");
  }

  const rule = matchingRules[0];
  if (!rule) {
    return null;
  }

  return {
    operationAmountCents: amountCents,
    commissionAmountCents: rule.fixedAmountCents,
    ruleId: rule.id,
    ruleVersion: rule.version,
    calculationType: rule.calculationType,
  };
}

export function validateCommissionRules(
  rules: CommissionRule[],
): CommissionValidationResult {
  const errors: CommissionValidationIssue[] = [];
  const warnings: CommissionCoverageWarning[] = [];

  for (const rule of rules) {
    errors.push(...validateSingleRule(rule));
  }

  for (const operationType of ["deposito", "retiro"] as const) {
    const activeRules = rules
      .filter(
        (rule) =>
          rule.operationType === operationType && rule.status === "active",
      )
      .sort((first, second) => first.minAmountCents - second.minAmountCents);

    const duplicateKeys = new Set<string>();
    for (const rule of activeRules) {
      const key = `${rule.minAmountCents}:${rule.maxAmountCents ?? "open"}`;
      if (duplicateKeys.has(key)) {
        errors.push({
          code: "duplicate",
          message: "Ya existe una regla con estos límites.",
          ruleId: rule.id,
        });
      }
      duplicateKeys.add(key);
    }

    const openRanges = activeRules.filter(
      (rule) => rule.maxAmountCents === null,
    );
    if (openRanges.length > 1) {
      for (const rule of openRanges.slice(1)) {
        errors.push({
          code: "open_range_limit",
          message: "Solo puede existir un rango sin límite máximo.",
          ruleId: rule.id,
        });
      }
    }

    for (let index = 0; index < activeRules.length - 1; index += 1) {
      const currentRule = activeRules[index];
      const nextRule = activeRules[index + 1];

      if (
        currentRule.maxAmountCents === null ||
        nextRule.minAmountCents <= currentRule.maxAmountCents
      ) {
        errors.push({
          code: "overlap",
          message: "Este rango se cruza con otro rango activo.",
          ruleId: nextRule.id,
        });
        continue;
      }

      const gapStart = currentRule.maxAmountCents + 1;
      const gapEnd = nextRule.minAmountCents - 1;
      if (gapStart <= gapEnd) {
        errors.push({
          code: "gap",
          message: `Hay montos sin comisión configurada entre ${formatCents(gapStart)} y ${formatCents(gapEnd)}.`,
          ruleId: nextRule.id,
        });
      }
    }

    const firstRule = activeRules[0];
    const lastRule = activeRules.at(-1);

    if (firstRule && firstRule.minAmountCents > 0) {
      warnings.push({
        code: "coverage_before_first",
        operationType,
        message: `Actualmente no hay comisión configurada para montos menores a ${formatCents(firstRule.minAmountCents)}.`,
      });
    }

    if (lastRule?.maxAmountCents !== null && lastRule?.maxAmountCents) {
      warnings.push({
        code: "coverage_after_last",
        operationType,
        message: `Actualmente no hay comisión configurada para montos mayores a ${formatCents(lastRule.maxAmountCents)}.`,
      });
    }
  }

  return { errors, warnings };
}

export function validateCommissionRuleCandidate(
  candidate: CommissionRuleCandidate,
  existingRules: CommissionRule[],
): CommissionValidationResult {
  const candidateRule: CommissionRule = {
    id: candidate.id ?? "candidate",
    operationType: candidate.operationType,
    minAmountCents: candidate.minAmountCents,
    maxAmountCents: candidate.maxAmountCents,
    calculationType: "fixed",
    fixedAmountCents: candidate.fixedAmountCents,
    status: candidate.status,
    version: candidate.version ?? 1,
    validFrom: candidate.validFrom ?? new Date().toISOString(),
    createdBy: candidate.createdBy ?? "Sistema",
  };

  const comparableRules = existingRules.filter(
    (rule) => rule.id !== candidateRule.id,
  );

  const result = validateCommissionRules([...comparableRules, candidateRule]);

  if (
    candidateRule.fixedAmountCents === 0 &&
    !candidate.zeroCommissionReason?.trim()
  ) {
    result.errors.push({
      code: "zero_commission_requires_reason",
      message:
        "Una comisión de $0.00 requiere confirmación y motivo obligatorio.",
      ruleId: candidateRule.id,
    });
  }

  return result;
}

export function hasCommissionRuleBeenApplied(
  ruleId: string,
  operations: Operation[],
): boolean {
  return operations.some(
    (operation) => operation.appliedCommissionSnapshot?.ruleId === ruleId,
  );
}

export function pesosToCents(value: number): number {
  return Math.round(value * 100);
}

export function parseCurrencyToCents(value: string): number | null {
  const normalizedValue = value.replace(/[$,\s]/g, "");
  if (normalizedValue === "") {
    return null;
  }

  if (!/^\d+(\.\d{0,2})?$/.test(normalizedValue)) {
    return null;
  }

  const [pesos, cents = ""] = normalizedValue.split(".");
  return Number(pesos) * 100 + Number(cents.padEnd(2, "0"));
}

export function centsToPesos(cents: number): number {
  return cents / 100;
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(centsToPesos(cents));
}

function validateSingleRule(rule: CommissionRule): CommissionValidationIssue[] {
  const errors: CommissionValidationIssue[] = [];

  if (
    rule.maxAmountCents !== null &&
    rule.minAmountCents > rule.maxAmountCents
  ) {
    errors.push({
      code: "inverted_range",
      message: "El monto mínimo no puede ser mayor que el monto máximo.",
      ruleId: rule.id,
    });
  }

  if (rule.fixedAmountCents < 0) {
    errors.push({
      code: "negative_commission",
      message: "La comisión no puede ser negativa.",
      ruleId: rule.id,
    });
  }

  return errors;
}

function isRuleEffective(rule: CommissionRule, effectiveDate: Date): boolean {
  const validFrom = new Date(rule.validFrom);
  if (Number.isNaN(validFrom.getTime()) || effectiveDate < validFrom) {
    return false;
  }

  if (!rule.validTo) {
    return true;
  }

  const validTo = new Date(rule.validTo);
  return !Number.isNaN(validTo.getTime()) && effectiveDate <= validTo;
}
