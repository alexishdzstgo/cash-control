import { AuditPage } from "@/components/audit/AuditPage";
import { OwnerOnlyGuard } from "@/components/guards/OwnerOnlyGuard";
import { mockOperations } from "@/components/history/mockOperations";

type AuditRouteProps = {
  searchParams?: Promise<{
    user?: string;
  }>;
};

export default async function AuditRoute({ searchParams }: AuditRouteProps) {
  const resolvedSearchParams = await searchParams;

  return (
    <OwnerOnlyGuard>
      <AuditPage
        operations={mockOperations}
        initialUserFilter={resolvedSearchParams?.user}
      />
    </OwnerOnlyGuard>
  );
}
