import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { SettingsClient } from "@/components/SettingsClient";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import { getMarketConfig } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isStaffRole(user.role)) redirect("/portal");

  const config = getMarketConfig();

  return (
    <AppShell user={user} usdToToman={config.usdToToman}>
      <SettingsClient initialConfig={config} />
    </AppShell>
  );
}
