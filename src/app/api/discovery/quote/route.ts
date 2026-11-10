import { NextResponse } from "next/server";
import { jsonError, requireStaffUser } from "@/lib/api-helpers";
import { getDb, getMarketConfig } from "@/lib/db";
import { getFullDiscoveryState, snapshotDieselHistory } from "@/lib/services";
import type { PriceCurrency, PriceSourceType, PriceUnit } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireStaffUser();
  if (auth.response) return auth.response;

  try {
    const body = (await req.json()) as {
      sourceId?: number;
      newSourceName?: string;
      newSourceType?: PriceSourceType;
      newSourceContact?: string;
      newSourceCity?: string;
      rawPrice?: number;
      currency?: PriceCurrency;
      unit?: PriceUnit;
      barrelLiters?: number;
      density?: number;
      includesBarrel?: boolean;
      freightPerBarrelToman?: number;
      availableBarrels?: number;
      notes?: string;
    };

    const rawPrice = Number(body.rawPrice);
    const currency = body.currency ?? "TOMAN";
    const unit = body.unit ?? "BARREL";

    if (Number.isNaN(rawPrice) || rawPrice <= 0) {
      return jsonError("مبلغ استعلام معتبر الزامی است.", 400);
    }

    const db = await getDb();
    const now = new Date().toISOString();
    let sourceId = Number(body.sourceId ?? 0);
    let defaultFreight = 0;

    if (body.newSourceName && body.newSourceName.trim().length > 0) {
      const cleanName = body.newSourceName.trim();
      const existing = await db.get<{
        id: number;
        default_freight_per_barrel_toman: number;
      }>(
        "SELECT id, default_freight_per_barrel_toman FROM price_sources WHERE name = ? LIMIT 1",
        cleanName
      );
      if (existing) {
        sourceId = Number(existing.id);
        defaultFreight = Number(existing.default_freight_per_barrel_toman);
      } else {
        const created = await db.run(
          `INSERT INTO price_sources (
            name, code, type, city, contact_info, api_url, confidence_weight,
            default_freight_per_barrel_toman, is_active, created_at
          ) VALUES (?, ?, ?, ?, ?, '', 85, 0, 1, ?)`,
          cleanName,
          `Q-${Date.now().toString().slice(-6)}`,
          body.newSourceType ?? "BROKER_PHONE",
          (body.newSourceCity ?? "واتساپ / تلفنی").trim(),
          (body.newSourceContact ?? "").trim(),
          now
        );
        sourceId = Number(created.lastInsertRowid);
      }
    } else {
      const source = await db.get<{
        id: number;
        default_freight_per_barrel_toman: number;
      }>(
        "SELECT id, default_freight_per_barrel_toman FROM price_sources WHERE id = ?",
        sourceId
      );
      if (!source) {
        return jsonError("دلال یا کانال استعلام انتخاب‌شده یافت نشد.", 404);
      }
      defaultFreight = Number(source.default_freight_per_barrel_toman);
    }

    const config = await getMarketConfig();
    const barrelLiters = Math.max(
      Number(body.barrelLiters ?? config.defaultBarrelLiters),
      10
    );
    const density = Math.min(
      0.95,
      Math.max(0.7, Number(body.density ?? config.dieselDensity))
    );
    const freight =
      body.freightPerBarrelToman !== undefined
        ? Math.max(Number(body.freightPerBarrelToman), 0)
        : defaultFreight;

    const result = await db.run(
      `INSERT INTO price_quotes (
        source_id, fuel_type, raw_price, currency, unit, barrel_liters, density,
        includes_barrel, freight_per_barrel_toman, available_barrels, notes,
        recorded_by, recorded_at
      ) VALUES (?, 'DIESEL', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      sourceId,
      rawPrice,
      currency,
      unit,
      barrelLiters,
      density,
      body.includesBarrel === false ? 0 : 1,
      freight,
      Math.max(Math.floor(Number(body.availableBarrels ?? 1)), 0),
      (body.notes ?? "").trim(),
      auth.user.name,
      now
    );

    await snapshotDieselHistory();

    return NextResponse.json(
      {
        ok: true,
        quoteId: Number(result.lastInsertRowid),
        state: await getFullDiscoveryState(),
      },
      { status: 201 }
    );
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "خطا در ثبت استعلام گازوئیل",
      500
    );
  }
}
