import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ensureSmsSchedulerStarted } from "@/lib/sms-automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDb();
    ensureSmsSchedulerStarted();
    const row = await db.get<{ cnt: number | string }>(
      "SELECT COUNT(*) AS cnt FROM products"
    );
    return NextResponse.json({
      ok: true,
      service: "petronabz-pwa",
      dialect: db.dialect,
      productsCount: Number(row?.cnt ?? 0),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "DB error" },
      { status: 500 }
    );
  }
}
