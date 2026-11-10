import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { SettingsClient } from "@/components/SettingsClient";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import { getDb, getMarketConfig, mapUserRow } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isStaffRole(user.role)) redirect("/portal");

  const config = await getMarketConfig();
  let initialUsers: ReturnType<typeof mapUserRow>[] = [];
  if (user.role === "ADMIN") {
    const db = await getDb();
    const rows = await db.all<Record<string, unknown>>(
      "SELECT * FROM users ORDER BY CASE role WHEN 'ADMIN' THEN 1 WHEN 'SALES' THEN 2 ELSE 3 END, id ASC"
    );
    initialUsers = rows.map(mapUserRow);
  }

  return (
    <AppShell user={user} usdToToman={config.usdToToman}>
      <SettingsClient
        initialConfig={config}
        currentUser={user}
        initialUsers={initialUsers}
      />
    </AppShell>
  );
}
