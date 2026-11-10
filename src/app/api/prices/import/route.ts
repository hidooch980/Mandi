import { NextResponse } from "next/server";
import { jsonError, requireStaffUser } from "@/lib/api-helpers";
import { parseCsvQuotes } from "@/lib/csv-importer";
import { getDb, getMarketConfig } from "@/lib/db";
import { getFullDiscoveryState, snapshotDieselHistory } from "@/lib/services";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireStaffUser();
  if (auth.response) return auth.response;

  try {
    const body = (await req.json()) as {
      csvText?: string;
    };
    const csvText = body.csvText ?? "";
    const parsed = parseCsvQuotes(csvText);

    if (parsed.rows.length === 0) {
      return jsonError(
        parsed.errors[0] || "هیچ ردیف استعلام معتبری برای ثبت پیدا نشد.",
        400
      );
    }

    const db = await getDb();
    const config = await getMarketConfig();
    const now = new Date().toISOString();

    const findSourceSql = "SELECT id FROM price_sources WHERE name = ? LIMIT 1";
    const insertSourceSql = `
      INSERT INTO price_sources (
        name, code, type, city, contact_info, api_url, confidence_weight,
        default_freight_per_barrel_toman, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, '', ?, ?, 1, ?)
    `;
    const insertQuoteSql = `
      INSERT INTO price_quotes (
        source_id, fuel_type, raw_price, currency, unit, barrel_liters, density,
        includes_barrel, freight_per_barrel_toman, available_barrels, notes,
        recorded_by, recorded_at
      ) VALUES (?, 'DIESEL', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    let importedCount = 0;
    for (const row of parsed.rows) {
      let sourceRow = await db.get<{ id: number }>(findSourceSql, row.sourceName);
      if (!sourceRow) {
        const code = `IMP-${Date.now().toString().slice(-4)}-${importedCount + 1}`;
        const created = await db.run(
          insertSourceSql,
          row.sourceName,
          code,
          row.sourceType,
          row.city,
          row.contactInfo,
          row.confidenceWeight,
          row.freightPerBarrelToman,
          now
        );
        sourceRow = { id: Number(created.lastInsertRowid) };
      }

      await db.run(
        insertQuoteSql,
        sourceRow.id,
        row.rawPrice,
        row.currency,
        row.unit,
        config.defaultBarrelLiters,
        config.dieselDensity,
        row.includesBarrel ? 1 : 0,
        row.freightPerBarrelToman,
        row.availableBarrels,
        row.notes,
        `${auth.user.name} (ایمپورت)`,
        now
      );
      importedCount += 1;
    }

    await snapshotDieselHistory();

    return NextResponse.json({
      ok: true,
      importedCount,
      warnings: parsed.errors,
      state: await getFullDiscoveryState(),
    });
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "خطا در ورود گروهی استعلام‌ها",
      500
    );
  }
}
