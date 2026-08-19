import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  action,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={`mb-6 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between ${className ?? ""}`}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-surface-text-primary">
          {title}
        </h1>

        {description && (
          <p className="mt-1 max-w-2xl text-sm leading-6 text-surface-text-secondary">
            {description}
          </p>
        )}
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
