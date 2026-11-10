import { NextResponse } from "next/server";
import { jsonError, requireStaffUser } from "@/lib/api-helpers";
import { getDb, listPriceSources } from "@/lib/db";
import type { PriceSourceType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, sources: await listPriceSources() });
}

export async function POST(req: Request) {
  const auth = await requireStaffUser();
  if (auth.response) return auth.response;

  try {
    const body = (await req.json()) as {
      name?: string;
      code?: string;
      type?: PriceSourceType;
      city?: string;
      contactInfo?: string;
      apiUrl?: string;
      confidenceWeight?: number;
      defaultFreightPerBarrelToman?: number;
      isSmsTarget?: boolean;
    };

    const name = (body.name ?? "").trim();
    const city = (body.city ?? "محل / منطقه").trim();
    if (!name) {
      return jsonError("نام دلال یا کانال واتساپ الزامی است.", 400);
    }

    const code =
      (body.code ?? "").trim().toUpperCase() ||
      `BRK-${Date.now().toString().slice(-5)}`;
    const weight = Math.min(100, Math.max(10, Number(body.confidenceWeight ?? 85)));
    const freight = Math.max(Number(body.defaultFreightPerBarrelToman ?? 0), 0);

    const db = await getDb();
    const existing = await db.get("SELECT id FROM price_sources WHERE code = ?", code);
    if (existing) {
      return jsonError("کد معرف تکراری است.", 409);
    }

    const res = await db.run(
      `INSERT INTO price_sources (
        name, code, type, city, contact_info, api_url, confidence_weight,
        default_freight_per_barrel_toman, is_active, is_sms_target, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      name,
      code,
      body.type ?? "BROKER_PHONE",
      city,
      (body.contactInfo ?? "").trim(),
      (body.apiUrl ?? "").trim(),
      weight,
      freight,
      body.isSmsTarget ? 1 : 0,
      new Date().toISOString()
    );

    return NextResponse.json(
      {
        ok: true,
        sourceId: Number(res.lastInsertRowid),
        sources: await listPriceSources(),
      },
      { status: 201 }
    );
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "خطا در افزودن دلال / کانال",
      500
    );
  }
}
