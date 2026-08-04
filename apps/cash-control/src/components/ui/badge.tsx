import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
  {
    variants: {
      variant: {
        success: "bg-emerald-50 text-emerald-700 border border-emerald-200",
        info: "bg-blue-50 text-blue-700 border border-blue-200",
        alert: "bg-amber-50 text-amber-700 border border-amber-200",
        error: "bg-red-50 text-red-700 border border-red-200",
        neutral: "bg-slate-100 text-slate-700 border border-slate-200",
        brand: "bg-[#EFF6FF] text-[#2563EB] border border-[#DBEAFE]",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { badgeVariants };