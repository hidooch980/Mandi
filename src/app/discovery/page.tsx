import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { DiscoveryClient } from "@/components/DiscoveryClient";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import { getFullDiscoveryState } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function DiscoveryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isStaffRole(user.role)) redirect("/portal");

  const state = await getFullDiscoveryState();

  return (
    <AppShell user={user} usdToToman={state.config.usdToToman}>
      <DiscoveryClient
        initialState={{
          config: state.config,
          sources: state.sources,
          summary: state.summary,
          history: state.history,
        }}
      />
    </AppShell>
  );
}
