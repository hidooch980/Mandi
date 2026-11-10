import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ensureSmsSchedulerStarted } from "@/lib/sms-automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    ensureSmsSchedulerStarted();
    const row = db.prepare("SELECT COUNT(*) AS cnt FROM products").get() as {
      cnt: number;
    };
    return NextResponse.json({
      ok: true,
      service: "petronabz-pwa",
      productsCount: row.cnt,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "DB error" },
      { status: 500 }
    );
  }
}
