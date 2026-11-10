import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { SmsAutomationClient } from "@/components/SmsAutomationClient";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import {
  getMarketConfig,
  getSmsConfig,
  listPriceSources,
  listSmsLogs,
} from "@/lib/db";
import { ensureSmsSchedulerStarted } from "@/lib/sms-automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SmsAutomationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isStaffRole(user.role)) redirect("/portal");

  ensureSmsSchedulerStarted();
  const [marketConfig, smsConfig, sources, logs] = await Promise.all([
    getMarketConfig(),
    getSmsConfig(),
    listPriceSources(),
    listSmsLogs(60),
  ]);

  return (
    <AppShell user={user} usdToToman={marketConfig.usdToToman}>
      <SmsAutomationClient
        initialConfig={smsConfig}
        initialSources={sources}
        initialLogs={logs}
      />
    </AppShell>
  );
}
