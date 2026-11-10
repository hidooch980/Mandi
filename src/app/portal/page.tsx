import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { CustomerPortalClient } from "@/components/CustomerPortalClient";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import { getMarketConfig, listOrders } from "@/lib/db";
import { listProductsWithPricing } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CustomerPortalPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const config = getMarketConfig();
  const products = listProductsWithPricing(true);
  const orders = isStaffRole(user.role) ? listOrders() : listOrders(user.id);

  return (
    <AppShell user={user} usdToToman={config.usdToToman}>
      <CustomerPortalClient
        user={user}
        products={products}
        initialOrders={orders}
        config={config}
      />
    </AppShell>
  );
}
