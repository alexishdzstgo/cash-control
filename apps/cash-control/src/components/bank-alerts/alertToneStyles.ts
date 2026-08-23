export type AlertTone = "success" | "warning" | "critical" | "review";

export const alertToneStyles: Record<
  AlertTone,
  {
    accentBorder: string;
    badge: string;
    border: string;
    icon: string;
    progress: string;
    softPanel: string;
    text: string;
  }
> = {
  success: {
    accentBorder: "border-l-emerald-200",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    border: "border-surface-border",
    icon: "bg-emerald-50 text-emerald-600",
    progress: "bg-emerald-500",
    softPanel: "border-surface-border bg-white",
    text: "text-emerald-700",
  },
  warning: {
    accentBorder: "border-l-amber-200",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    border: "border-surface-border",
    icon: "bg-amber-50 text-amber-600",
    progress: "bg-amber-500",
    softPanel: "border-surface-border bg-white",
    text: "text-amber-700",
  },
  critical: {
    accentBorder: "border-l-red-200",
    badge: "border-red-200 bg-red-50 text-red-700",
    border: "border-surface-border",
    icon: "bg-red-50 text-red-600",
    progress: "bg-red-500",
    softPanel: "border-surface-border bg-white",
    text: "text-red-700",
  },
  review: {
    accentBorder: "border-l-blue-200",
    badge: "border-blue-200 bg-blue-50 text-blue-700",
    border: "border-surface-border",
    icon: "bg-blue-50 text-primary-blue",
    progress: "bg-primary-blue",
    softPanel: "border-surface-border bg-white",
    text: "text-blue-700",
  },
};
