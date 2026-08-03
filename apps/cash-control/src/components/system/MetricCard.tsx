import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  description: string;
  secondaryText?: string;
  icon: LucideIcon;
  accentClass: string;
  iconClass: string;
  className?: string;
  href?: string;
  featured?: boolean;
}

export function MetricCard({
  title,
  value,
  description,
  secondaryText,
  icon: Icon,
  accentClass,
  iconClass,
  className,
  href,
  featured = false,
}: MetricCardProps) {
  const card = (
    <div
      className={`
        relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm
        transition-all duration-200
        ${href ? "hover:-translate-y-0.5 hover:shadow-md cursor-pointer" : ""}
        ${className || ""}
      `}
    >
      <div className={`absolute left-0 top-1/2 h-14 w-1 -translate-y-1/2 rounded-r-full ${accentClass}`} />

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconClass}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
        </div>

        {href && (
          <ArrowRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
        )}
      </div>

      <p
        className={`
          mt-4 font-bold tracking-tight text-slate-950 transition-opacity duration-200 tabular-nums
          ${featured ? "text-4xl md:text-5xl" : "text-3xl"}
        `}
      >
        {value}
      </p>

      <p className="mt-2 text-sm text-slate-500">{description}</p>

      {secondaryText && (
        <div className="mt-4 border-t border-slate-100 pt-4 text-xs font-medium text-slate-500">
          {secondaryText}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 rounded-2xl block"
      >
        {card}
      </Link>
    );
  }

  return card;
}