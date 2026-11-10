import { NextResponse } from "next/server";
import { jsonError, requireStaffUser } from "@/lib/api-helpers";
import { getDb } from "@/lib/db";
import { listProductsWithPricing } from "@/lib/services";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const productId = Number(id);
  if (!productId) return jsonError("شناسه محصول معتبر نیست.", 400);

  try {
    const body = (await req.json()) as Partial<{
      stockBarrels: number;
      pricingMode: "AUTO_DISCOVERY" | "MANUAL";
      marginPercent: number;
      lastCostPerBarrelToman: number;
      manualPricePerBarrelToman: number;
      isActive: boolean;
      minOrderBarrels: number;
    }>;

    const db = getDb();
    const row = db
      .prepare("SELECT * FROM products WHERE id = ?")
      .get(productId) as Record<string, unknown> | undefined;
    if (!row) return jsonError("محصول یافت نشد.", 404);

    db.prepare(
      `UPDATE products SET
        stock_barrels = ?,
        pricing_mode = ?,
        margin_percent = ?,
        last_cost_per_barrel_toman = ?,
        manual_price_per_barrel_toman = ?,
        is_active = ?,
        min_order_barrels = ?,
        updated_at = ?
      WHERE id = ?`
    ).run(
      body.stockBarrels !== undefined
        ? Math.max(Math.floor(Number(body.stockBarrels)), 0)
        : Number(row.stock_barrels),
      body.pricingMode ?? String(row.pricing_mode),
      body.marginPercent !== undefined
        ? Number(body.marginPercent)
        : Number(row.margin_percent),
      body.lastCostPerBarrelToman !== undefined
        ? Math.max(Number(body.lastCostPerBarrelToman), 0)
        : Number(row.last_cost_per_barrel_toman ?? 0),
      body.manualPricePerBarrelToman !== undefined
        ? Math.max(Number(body.manualPricePerBarrelToman), 0)
        : Number(row.manual_price_per_barrel_toman),
      body.isActive !== undefined ? (body.isActive ? 1 : 0) : Number(row.is_active),
      body.minOrderBarrels !== undefined
        ? Math.max(Math.floor(Number(body.minOrderBarrels)), 1)
        : Number(row.min_order_barrels),
      new Date().toISOString(),
      productId
    );

    return NextResponse.json({
      ok: true,
      products: listProductsWithPricing(false),
    });
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "خطا در ویرایش محصول",
      500
    );
  }
}
