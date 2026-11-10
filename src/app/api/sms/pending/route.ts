import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-helpers";
import { getDb, getSmsConfig } from "@/lib/db";
import { dispatchHourlySmsInquiries } from "@/lib/sms-automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidSecret(provided: string | null, expected: string): boolean {
  if (!provided || !expected) return false;
  try {
    const a = Buffer.from(provided, "utf8");
    const b = Buffer.from(expected, "utf8");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Called by the manager's Android phone automation app (MacroDroid / Tasker / SMS Gateway)
 * to check if any hourly outbound SMS jobs are queued for the manager's SIM card.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret =
    searchParams.get("secret") || req.headers.get("x-sms-secret");
  const cfg = getSmsConfig();

  if (!isValidSecret(secret, cfg.gatewaySecret)) {
    return jsonError("کلید امنیتی پیامک معتبر نیست.", 401);
  }

  // Trigger due hourly cycle if scheduler hasn't ticked yet
  await dispatchHourlySmsInquiries({ force: false });

  const db = getDb();
  const jobs = db
    .prepare(
      "SELECT id, source_name, phone, message, created_at FROM sms_logs WHERE direction = 'OUTBOUND' AND status = 'QUEUED' ORDER BY id ASC LIMIT 25"
    )
    .all() as {
    id: number;
    source_name: string;
    phone: string;
    message: string;
    created_at: string;
  }[];

  return NextResponse.json({
    ok: true,
    managerPhone: cfg.managerPhone,
    jobs: jobs.map((j) => ({
      id: j.id,
      name: j.source_name,
      phone: j.phone,
      message: j.message,
      createdAt: j.created_at,
    })),
  });
}

/**
 * Called by the manager's Android phone after sending each queued SMS from the SIM card.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      secret?: string;
      id?: number;
      status?: "SENT" | "FAILED";
    };
    const cfg = getSmsConfig();
    if (!isValidSecret(body.secret ?? req.headers.get("x-sms-secret"), cfg.gatewaySecret)) {
      return jsonError("کلید امنیتی پیامک معتبر نیست.", 401);
    }

    const logId = Number(body.id);
    if (!logId) return jsonError("شناسه پیامک الزامی است.", 400);

    const status = body.status === "FAILED" ? "FAILED" : "SENT";
    const db = getDb();
    db.prepare(
      "UPDATE sms_logs SET status = ? WHERE id = ? AND direction = 'OUTBOUND'"
    ).run(status, logId);

    return NextResponse.json({ ok: true, id: logId, status });
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "خطا در ثبت وضعیت ارسال پیامک",
      500
    );
  }
}
