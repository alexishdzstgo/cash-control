import { DepositPage } from "@/components/deposits/DepositPage";
import { Sidebar } from "@/components/layout/Sidebar";

export default function DepositsRoute() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />

      <main className="min-w-0 flex-1 p-6 lg:p-8">
        <DepositPage />
      </main>
    </div>
  );
}