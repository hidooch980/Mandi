import { NextResponse } from "next/server";
import { requireStaffUser } from "@/lib/api-helpers";
import { getSmsConfig, listSmsLogs } from "@/lib/db";
import {
  dispatchHourlySmsInquiries,
  ensureSmsSchedulerStarted,
} from "@/lib/sms-automation";

export const runtime = "nodejs";

export async function POST() {
  const auth = await requireStaffUser();
  if (auth.response) return auth.response;

  ensureSmsSchedulerStarted();
  const result = await dispatchHourlySmsInquiries({ force: true });
  const [config, logs] = await Promise.all([getSmsConfig(), listSmsLogs(60)]);

  return NextResponse.json({
    ok: true,
    result,
    config,
    logs,
  });
}
