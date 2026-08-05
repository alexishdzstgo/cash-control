import { Suspense } from "react";
import { ProfilePage } from "@/components/profile/ProfilePage";

export default function ProfileRoute() {
  return (
    <Suspense fallback={null}>
      <ProfilePage />
    </Suspense>
  );
}
