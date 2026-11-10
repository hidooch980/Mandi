import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ReportsClient } from "@/components/ReportsClient";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import {
  getLedgerSummary,
  getMarketConfig,
  listExpenses,
  listOrders,
} from "@/lib/db";
import { listProductsWithPricing } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isStaffRole(user.role)) redirect("/portal");

  const [config, orders, expenses, products, ledgerSummary] = await Promise.all([
    getMarketConfig(),
    listOrders(),
    listExpenses(),
    listProductsWithPricing(false),
    getLedgerSummary(),
  ]);

  return (
    <AppShell user={user} usdToToman={config.usdToToman}>
      <ReportsClient
        orders={orders}
        initialExpenses={expenses}
        products={products}
        ledgerSummary={ledgerSummary}
      />
    </AppShell>
  );
}
