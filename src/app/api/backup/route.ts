import { NextResponse } from "next/server";
import { requireStaffUser } from "@/lib/api-helpers";
import {
  getMarketConfig,
  listLatestPriceQuotes,
  listOrders,
  listPriceSources,
  listWarehouses,
} from "@/lib/db";
import { listProductsWithPricing } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireStaffUser();
  if (auth.response) return auth.response;

  const snapshot = {
    exportedAt: new Date().toISOString(),
    config: getMarketConfig(),
    sources: listPriceSources(),
    latestDieselQuotes: listLatestPriceQuotes(true),
    warehouses: listWarehouses(),
    products: listProductsWithPricing(false),
    trades: listOrders(),
  };

  return new NextResponse(JSON.stringify(snapshot, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="petronabz-backup-${new Date()
        .toISOString()
        .slice(0, 10)}.json"`,
    },
  });
}
