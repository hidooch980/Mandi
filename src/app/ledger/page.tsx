import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { LedgerClient } from "@/components/LedgerClient";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import {
  getDb,
  getLedgerSummary,
  getMarketConfig,
  listPriceSources,
  mapUserRow,
} from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function LedgerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isStaffRole(user.role)) redirect("/portal");

  const db = await getDb();
  const [config, summary, buyerRows, sellers] = await Promise.all([
    getMarketConfig(),
    getLedgerSummary(),
    db.all<Record<string, unknown>>(
      "SELECT * FROM users WHERE role = 'CUSTOMER' ORDER BY id DESC"
    ),
    listPriceSources(),
  ]);

  return (
    <AppShell user={user} usdToToman={config.usdToToman}>
      <LedgerClient
        initialSummary={summary}
        buyers={buyerRows.map(mapUserRow)}
        sellers={sellers}
      />
    </AppShell>
  );
}
