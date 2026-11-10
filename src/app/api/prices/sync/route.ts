import { NextResponse } from "next/server";
import { jsonError, requireStaffUser } from "@/lib/api-helpers";
import { getDb, getMarketConfig, listLatestPriceQuotes, listPriceSources } from "@/lib/db";
import { getFullDiscoveryState, snapshotDieselHistory } from "@/lib/services";
import type { PriceCurrency, PriceUnit } from "@/lib/types";

export const runtime = "nodejs";

function isSafeExternalUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.startsWith("169.254.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const auth = await requireStaffUser();
  if (auth.response) return auth.response;

  try {
    const body = (await req.json().catch(() => ({}))) as {
      mode?: "LIVE" | "SIMULATE";
    };
    const mode = body.mode ?? "LIVE";

    const db = await getDb();
    const [config, allSources, latestQuotes] = await Promise.all([
      getMarketConfig(),
      listPriceSources(),
      listLatestPriceQuotes(false),
    ]);
    const sources = allSources.filter((s) => s.isActive);
    const now = new Date().toISOString();

    const insertQuoteSql = `
      INSERT INTO price_quotes (
        source_id, fuel_type, raw_price, currency, unit, barrel_liters, density,
        includes_barrel, freight_per_barrel_toman, available_barrels, notes,
        recorded_by, recorded_at
      ) VALUES (?, 'DIESEL', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    let syncedCount = 0;
    const logs: string[] = [];

    if (mode === "LIVE") {
      const apiSources = sources.filter((s) => s.apiUrl.trim().length > 0);
      if (apiSources.length === 0) {
        return jsonError(
          "هیچ فرد یا منبعی آدرس JSON API فعال ندارد. استعلام‌ها را دستی یا با اکسل/CSV ثبت کنید یا از شبیه‌سازی نوسان بازار استفاده نمایید.",
          400
        );
      }

      for (const src of apiSources) {
        if (!isSafeExternalUrl(src.apiUrl)) {
          logs.push(`${src.name}: آدرس URL نامعتبر یا غیرمجاز است.`);
          continue;
        }
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 6000);
          const resp = await fetch(src.apiUrl, { signal: controller.signal });
          clearTimeout(timer);
          if (!resp.ok) {
            logs.push(`${src.name}: خطای HTTP ${resp.status}`);
            continue;
          }
          const payload = (await resp.json()) as {
            price?: number;
            currency?: PriceCurrency;
            unit?: PriceUnit;
            includesBarrel?: boolean;
            availableBarrels?: number;
          };
          if (!payload.price || payload.price <= 0) {
            logs.push(`${src.name}: فیلد price معتبر در خروجی JSON یافت نشد.`);
            continue;
          }
          await db.run(
            insertQuoteSql,
            src.id,
            payload.price,
            payload.currency ?? "TOMAN",
            payload.unit ?? "BARREL",
            config.defaultBarrelLiters,
            config.dieselDensity,
            payload.includesBarrel ? 1 : 0,
            src.defaultFreightPerBarrelToman,
            payload.availableBarrels ?? 100,
            "همگام‌سازی خودکار فید گازوئیل",
            "API Sync",
            now
          );
          syncedCount += 1;
          logs.push(`${src.name}: نرخ جدید گازوئیل ثبت شد.`);
        } catch (err) {
          logs.push(
            `${src.name}: ${err instanceof Error ? err.message : "خطای ارتباط"}`
          );
        }
      }
    } else {
      const sampleQuotes = latestQuotes.slice(0, 6);
      for (const q of sampleQuotes) {
        const deltaFactor = 1 + (Math.random() * 0.026 - 0.013);
        const updatedRaw =
          q.currency === "USD" || q.currency === "AED"
            ? Number((q.rawPrice * deltaFactor).toFixed(2))
            : Math.round(q.rawPrice * deltaFactor);

        await db.run(
          insertQuoteSql,
          q.sourceId,
          updatedRaw,
          q.currency,
          q.unit,
          q.barrelLiters,
          q.density,
          q.includesBarrel ? 1 : 0,
          q.freightPerBarrelToman,
          q.availableBarrels,
          "بروزرسانی شبیه‌سازی نوسان استعلام‌های گازوئیل",
          `${auth.user.name} (شبیه‌ساز)`,
          now
        );
        syncedCount += 1;
      }
      logs.push(`${syncedCount} استعلام گازوئیل با نوسان لحظه‌ای بازار بروزرسانی شد.`);
    }

    await snapshotDieselHistory();

    return NextResponse.json({
      ok: true,
      syncedCount,
      logs,
      state: await getFullDiscoveryState(),
    });
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "خطا در همگام‌سازی استعلام‌ها",
      500
    );
  }
}
