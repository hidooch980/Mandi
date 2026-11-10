import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { CustomersClient } from "@/components/CustomersClient";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import {
  getMarketConfig,
  listBuyersWithStats,
  listSellersWithStats,
} from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isStaffRole(user.role)) redirect("/portal");

  const config = getMarketConfig();
  const buyers = listBuyersWithStats();
  const sellers = listSellersWithStats();

  return (
    <AppShell user={user} usdToToman={config.usdToToman}>
      <CustomersClient initialBuyers={buyers} initialSellers={sellers} />
    </AppShell>
  );
}
