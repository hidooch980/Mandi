import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { OrdersClient } from "@/components/OrdersClient";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import { getDb, getMarketConfig, listOrders, listPriceSources, mapUserRow } from "@/lib/db";
import { listProductsWithPricing } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isStaffRole(user.role)) redirect("/portal");

  const config = getMarketConfig();
  const orders = listOrders();
  const products = listProductsWithPricing(false);
  const db = getDb();
  const customerRows = db
    .prepare("SELECT * FROM users WHERE role = 'CUSTOMER' ORDER BY id DESC")
    .all() as Record<string, unknown>[];
  const customers = customerRows.map(mapUserRow);
  const sellers = listPriceSources().filter((s) => s.isActive);

  return (
    <AppShell user={user} usdToToman={config.usdToToman}>
      <OrdersClient
        initialOrders={orders}
        products={products}
        customers={customers}
        sellers={sellers}
        config={config}
      />
    </AppShell>
  );
}
