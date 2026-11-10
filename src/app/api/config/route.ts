import { NextResponse } from "next/server";
import { jsonError, requireStaffUser } from "@/lib/api-helpers";
import { getDb, getMarketConfig } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, config: await getMarketConfig() });
}

export async function PATCH(req: Request) {
  const auth = await requireStaffUser();
  if (auth.response) return auth.response;

  try {
    const body = (await req.json()) as Partial<{
      usdToToman: number;
      aedToToman: number;
      dieselDensity: number;
      gasolineDensity: number;
      defaultBarrelLiters: number;
      emptyBarrelCostToman: number;
      fillingCostToman: number;
      vatPercent: number;
      targetMarginPercent: number;
      fixedProfitPerBarrelToman: number;
      publishedDieselBarrelToman: number;
      publishedGasolineBarrelToman: number;
      companyTitle: string;
      companyPhone: string;
      companyAddress: string;
      companyEconomicCode: string;
    }>;

    const cur = await getMarketConfig();
    const db = await getDb();
    const now = new Date().toISOString();

    await db.run(
      `
      UPDATE market_config SET
        usd_to_toman = ?,
        aed_to_toman = ?,
        diesel_density = ?,
        gasoline_density = ?,
        default_barrel_liters = ?,
        empty_barrel_cost_toman = ?,
        filling_cost_toman = ?,
        vat_percent = ?,
        target_margin_percent = ?,
        fixed_profit_per_barrel_toman = ?,
        published_diesel_barrel_toman = ?,
        published_gasoline_barrel_toman = ?,
        company_title = ?,
        company_phone = ?,
        company_address = ?,
        company_economic_code = ?,
        updated_at = ?
      WHERE id = 1
    `,
      Math.max(Number(body.usdToToman ?? cur.usdToToman), 1),
      Math.max(Number(body.aedToToman ?? cur.aedToToman), 1),
      Math.min(0.95, Math.max(0.7, Number(body.dieselDensity ?? cur.dieselDensity))),
      Math.min(0.9, Math.max(0.65, Number(body.gasolineDensity ?? cur.gasolineDensity))),
      Math.max(Number(body.defaultBarrelLiters ?? cur.defaultBarrelLiters), 10),
      Math.max(Number(body.emptyBarrelCostToman ?? cur.emptyBarrelCostToman), 0),
      Math.max(Number(body.fillingCostToman ?? cur.fillingCostToman), 0),
      Math.max(Number(body.vatPercent ?? cur.vatPercent), 0),
      Math.max(Number(body.targetMarginPercent ?? cur.targetMarginPercent), 0),
      Math.max(
        Number(body.fixedProfitPerBarrelToman ?? cur.fixedProfitPerBarrelToman),
        0
      ),
      Math.max(
        Number(body.publishedDieselBarrelToman ?? cur.publishedDieselBarrelToman),
        0
      ),
      Math.max(
        Number(body.publishedGasolineBarrelToman ?? cur.publishedGasolineBarrelToman),
        0
      ),
      (body.companyTitle ?? cur.companyTitle).trim(),
      (body.companyPhone ?? cur.companyPhone).trim(),
      (body.companyAddress ?? cur.companyAddress).trim(),
      (body.companyEconomicCode ?? cur.companyEconomicCode).trim(),
      now
    );

    return NextResponse.json({ ok: true, config: await getMarketConfig() });
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "خطا در ذخیره تنظیمات بازار",
      500
    );
  }
}
