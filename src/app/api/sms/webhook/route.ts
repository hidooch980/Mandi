import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-helpers";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import { getSmsConfig, listSmsLogs } from "@/lib/db";
import { processInboundSmsReply } from "@/lib/sms-automation";

export const runtime = "nodejs";

function isValidSecret(provided: string | null | undefined, expected: string): boolean {
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
 * Receives inbound SMS replies forwarded from the manager's SIM card (Android MacroDroid/Tasker)
 * OR tested directly by logged-in staff from the UI simulator.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      secret?: string;
      from?: string;
      phone?: string;
      sender?: string;
      message?: string;
      text?: string;
      body?: string;
    };

    const cfg = getSmsConfig();
    const providedSecret = body.secret ?? req.headers.get("x-sms-secret");
    const hasSecret = isValidSecret(providedSecret, cfg.gatewaySecret);

    if (!hasSecret) {
      const user = await getCurrentUser();
      if (!user || !isStaffRole(user.role)) {
        return jsonError("کلید امنیتی Webhook یا نشست کاربری معتبر نیست.", 401);
      }
    }

    const fromPhone = (body.from || body.phone || body.sender || "").trim();
    const message = (body.message || body.text || body.body || "").trim();

    if (!message) {
      return jsonError("متن پیامک دریافتی خالی است.", 400);
    }

    const outcome = processInboundSmsReply({ fromPhone, message });

    return NextResponse.json({
      ...outcome,
      logs: listSmsLogs(60),
    });
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "خطا در پردازش پیامک دریافتی",
      500
    );
  }
}
