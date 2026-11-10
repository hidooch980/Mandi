import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { InventoryClient } from "@/components/InventoryClient";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import { getMarketConfig, listWarehouses } from "@/lib/db";
import { listProductsWithPricing } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isStaffRole(user.role)) redirect("/portal");

  const config = getMarketConfig();
  const products = listProductsWithPricing(false);
  const warehouses = listWarehouses();

  return (
    <AppShell user={user} usdToToman={config.usdToToman}>
      <InventoryClient
        initialProducts={products}
        initialWarehouses={warehouses}
        initialConfig={config}
      />
    </AppShell>
  );
}
