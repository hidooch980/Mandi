import { NextResponse } from "next/server";
import { jsonError, requireStaffUser } from "@/lib/api-helpers";
import { getDb } from "@/lib/db";
import { roundToThousand } from "@/lib/pricing-engine";
import {
  getDieselDiscoverySummary,
  getFullDiscoveryState,
  snapshotDieselHistory,
} from "@/lib/services";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireStaffUser();
  if (auth.response) return auth.response;

  try {
    const body = (await req.json().catch(() => ({}))) as {
      customBarrelPriceToman?: number;
    };
    const summary = await getDieselDiscoverySummary();

    const finalPrice =
      body.customBarrelPriceToman && body.customBarrelPriceToman > 0
        ? roundToThousand(Number(body.customBarrelPriceToman))
        : summary.suggestedSellPerBarrelToman;

    const db = await getDb();
    await db.run(
      `UPDATE market_config SET published_diesel_barrel_toman = ?, updated_at = ? WHERE id = 1`,
      finalPrice,
      new Date().toISOString()
    );

    await snapshotDieselHistory();

    return NextResponse.json({
      ok: true,
      publishedPrice: finalPrice,
      state: await getFullDiscoveryState(),
    });
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "خطا در انتشار قیمت فروش گازوئیل",
      500
    );
  }
}
