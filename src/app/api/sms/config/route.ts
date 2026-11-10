import { NextResponse } from "next/server";
import { jsonError, requireStaffUser } from "@/lib/api-helpers";
import {
  getDb,
  getSmsConfig,
  listPriceSources,
  listSmsLogs,
} from "@/lib/db";
import { ensureSmsSchedulerStarted } from "@/lib/sms-automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireStaffUser();
  if (auth.response) return auth.response;

  ensureSmsSchedulerStarted();
  const [config, sources, logs] = await Promise.all([
    getSmsConfig(),
    listPriceSources(),
    listSmsLogs(60),
  ]);
  return NextResponse.json({
    ok: true,
    config,
    sources,
    logs,
  });
}

export async function PATCH(req: Request) {
  const auth = await requireStaffUser();
  if (auth.response) return auth.response;

  try {
    const body = (await req.json()) as Partial<{
      isEnabled: boolean;
      intervalMinutes: number;
      managerPhone: string;
      messageTemplate: string;
      androidGatewayUrl: string;
      autoDiscoverOnReply: boolean;
    }>;

    const cur = await getSmsConfig();
    const db = await getDb();
    const now = new Date().toISOString();
    const interval = Math.min(
      1440,
      Math.max(5, Math.floor(Number(body.intervalMinutes ?? cur.intervalMinutes)))
    );
    const enabled = body.isEnabled !== undefined ? body.isEnabled : cur.isEnabled;
    const nextRunAt = enabled
      ? cur.nextRunAt || new Date(Date.now() + interval * 60_000).toISOString()
      : "";

    await db.run(
      `
      UPDATE sms_config SET
        is_enabled = ?,
        interval_minutes = ?,
        manager_phone = ?,
        message_template = ?,
        android_gateway_url = ?,
        auto_discover_on_reply = ?,
        next_run_at = ?,
        updated_at = ?
      WHERE id = 1
    `,
      enabled ? 1 : 0,
      interval,
      (body.managerPhone ?? cur.managerPhone).trim(),
      (body.messageTemplate ?? cur.messageTemplate).trim(),
      (body.androidGatewayUrl ?? cur.androidGatewayUrl).trim(),
      body.autoDiscoverOnReply !== undefined
        ? body.autoDiscoverOnReply
          ? 1
          : 0
        : cur.autoDiscoverOnReply
          ? 1
          : 0,
      nextRunAt,
      now
    );

    if (enabled) {
      ensureSmsSchedulerStarted();
    }

    const [config, sources, logs] = await Promise.all([
      getSmsConfig(),
      listPriceSources(),
      listSmsLogs(60),
    ]);

    return NextResponse.json({
      ok: true,
      config,
      sources,
      logs,
    });
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "خطا در ذخیره تنظیمات پیامک ساعتی",
      500
    );
  }
}
