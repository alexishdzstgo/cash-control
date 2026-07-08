interface PageHeaderProps {
  title: string;
  description?: string;
}

export function PageHeader({
  title,
  description,
}: PageHeaderProps) {
  return (
    <header className="mb-8">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">
        {title}
      </h1>

      {description && (
        <p className="mt-2 max-w-2xl text-slate-600">
          {description}
        </p>
      )}
    </header>
  );
}