import { AuditPage } from "@/components/audit/AuditPage";
import { OwnerOnlyGuard } from "@/components/guards/OwnerOnlyGuard";

type AuditRouteProps = {
  searchParams?: Promise<{
    user?: string;
  }>;
};

export default async function AuditRoute({ searchParams }: AuditRouteProps) {
  const resolvedSearchParams = await searchParams;

  return (
    <OwnerOnlyGuard>
      <AuditPage initialUserFilter={resolvedSearchParams?.user} />
    </OwnerOnlyGuard>
  );
}
