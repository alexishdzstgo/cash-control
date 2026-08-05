import { OwnerOnlyGuard } from "@/components/guards/OwnerOnlyGuard";
import { UsersPage } from "@/components/users/UsersPage";

export default function UsersRoute() {
  return (
    <OwnerOnlyGuard>
      <UsersPage />
    </OwnerOnlyGuard>
  );
}
