import { NextResponse } from "next/server";
import { jsonError, requireStaffUser } from "@/lib/api-helpers";
import { getDb } from "@/lib/db";
import { listProductsWithPricing } from "@/lib/services";
import type { FuelType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const activeOnly = searchParams.get("activeOnly") === "1";
  return NextResponse.json({
    ok: true,
    products: listProductsWithPricing(activeOnly),
  });
}

export async function POST(req: Request) {
  const auth = await requireStaffUser();
  if (auth.response) return auth.response;

  try {
    const body = (await req.json()) as {
      name?: string;
      sku?: string;
      fuelType?: FuelType;
      barrelType?: string;
      barrelLiters?: number;
      density?: number;
      warehouseId?: number;
      stockBarrels?: number;
      pricingMode?: "AUTO_DISCOVERY" | "MANUAL";
      marginPercent?: number;
      manualPricePerBarrelToman?: number;
      minOrderBarrels?: number;
      description?: string;
    };

    const name = (body.name ?? "").trim();
    const warehouseId = Number(body.warehouseId);
    const fuelType: FuelType = body.fuelType === "GASOLINE" ? "GASOLINE" : "DIESEL";
    if (!name || !warehouseId) {
      return jsonError("نام محصول و انبار الزامی است.", 400);
    }

    const sku =
      (body.sku ?? "").trim().toUpperCase() ||
      `${fuelType === "GASOLINE" ? "GAS" : "DSL"}-${Date.now().toString().slice(-5)}`;

    const db = getDb();
    const wh = db
      .prepare("SELECT id FROM warehouses WHERE id = ?")
      .get(warehouseId);
    if (!wh) return jsonError("انبار انتخاب‌شده یافت نشد.", 404);

    const dup = db.prepare("SELECT id FROM products WHERE sku = ?").get(sku);
    if (dup) return jsonError("کد SKU محصول تکراری است.", 409);

    const defaultDensity = fuelType === "GASOLINE" ? 0.745 : 0.835;

    const res = db
      .prepare(
        `INSERT INTO products (
          name, sku, fuel_type, barrel_type, barrel_liters, density, warehouse_id,
          stock_barrels, reserved_barrels, pricing_mode, margin_percent,
          manual_price_per_barrel_toman, min_order_barrels, is_active, description, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 1, ?, ?)`
      )
      .run(
        name,
        sku,
        fuelType,
        (body.barrelType ?? "بشکه فلزی ۲۲۰ لیتر").trim(),
        Math.max(Number(body.barrelLiters ?? 220), 10),
        Math.min(0.95, Math.max(0.65, Number(body.density ?? defaultDensity))),
        warehouseId,
        Math.max(Math.floor(Number(body.stockBarrels ?? 0)), 0),
        body.pricingMode ?? "AUTO_DISCOVERY",
        Number(body.marginPercent ?? 0),
        Math.max(Number(body.manualPricePerBarrelToman ?? 0), 0),
        Math.max(Math.floor(Number(body.minOrderBarrels ?? 1)), 1),
        (body.description ?? "").trim(),
        new Date().toISOString()
      );

    return NextResponse.json(
      {
        ok: true,
        productId: Number(res.lastInsertRowid),
        products: listProductsWithPricing(false),
      },
      { status: 201 }
    );
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "خطا در افزودن محصول",
      500
    );
  }
}
