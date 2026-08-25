"use client";

type ValidationErrors<Field extends string> = Partial<Record<Field, string>>;

type FocusFirstInvalidFieldOptions<Field extends string> = {
  errors: ValidationErrors<Field>;
  fieldOrder: readonly Field[];
  fieldSelector?: Partial<Record<Field, string>>;
};

const INVALID_FIELD_ATTRIBUTE = "data-validation-field";
const FOCUSABLE_SELECTOR = [
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "button:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function getValidationFieldProps(field: string) {
  return { [INVALID_FIELD_ATTRIBUTE]: field };
}

export function focusFirstInvalidField<Field extends string>({
  errors,
  fieldOrder,
  fieldSelector = {},
}: FocusFirstInvalidFieldOptions<Field>): Field | null {
  const firstInvalidField =
    fieldOrder.find((field) => Boolean(errors[field])) ?? null;

  if (!firstInvalidField || typeof document === "undefined") {
    return firstInvalidField;
  }

  window.requestAnimationFrame(() => {
    const target = findInvalidFieldTarget(
      firstInvalidField,
      fieldSelector[firstInvalidField],
    );

    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });

    const focusableElement = getFocusableElement(target);
    focusableElement?.focus({ preventScroll: true });
  });

  return firstInvalidField;
}

function findInvalidFieldTarget(field: string, selector?: string) {
  if (selector) {
    return document.querySelector<HTMLElement>(selector);
  }

  return document.querySelector<HTMLElement>(
    `[${INVALID_FIELD_ATTRIBUTE}="${field}"]`,
  );
}

function getFocusableElement(target: HTMLElement): HTMLElement | null {
  if (target.matches(FOCUSABLE_SELECTOR)) {
    return target;
  }

  return target.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
}
