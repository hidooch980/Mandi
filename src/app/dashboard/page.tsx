import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { DashboardClient } from "@/components/DashboardClient";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import { listOrders } from "@/lib/db";
import { getFullDiscoveryState } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isStaffRole(user.role)) redirect("/portal");

  const [state, orders] = await Promise.all([
    getFullDiscoveryState(),
    listOrders(),
  ]);

  return (
    <AppShell user={user} usdToToman={state.config.usdToToman}>
      <DashboardClient
        config={state.config}
        dieselSummary={state.summary}
        history={state.history}
        products={state.products}
        orders={orders}
      />
    </AppShell>
  );
}
