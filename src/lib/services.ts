import {
  getDb,
  getMarketConfig,
  listLatestPriceQuotes,
  listPriceHistory,
  listPriceSources,
  listWarehouses,
} from "./db.ts";
import { discoverDieselPricing, roundToThousand } from "./pricing-engine.ts";
import type {
  DieselDiscoverySummary,
  FuelType,
  MarketConfig,
  Product,
  TradeType,
} from "./types";

export async function getDieselDiscoverySummary(
  configOverride?: MarketConfig
): Promise<DieselDiscoverySummary> {
  const [config, quotes] = await Promise.all([
    configOverride ? Promise.resolve(configOverride) : getMarketConfig(),
    listLatestPriceQuotes(false),
  ]);
  return discoverDieselPricing(quotes, config);
}

export async function listProductsWithPricing(
  activeOnly = false
): Promise<Product[]> {
  const db = await getDb();
  const config = await getMarketConfig();
  const dieselSummary = await getDieselDiscoverySummary(config);

  const where = activeOnly ? "WHERE p.is_active = 1" : "";
  const rows = await db.all<Record<string, unknown>>(`
    SELECT p.*, w.name AS warehouse_name, w.city AS warehouse_city
    FROM products p
    INNER JOIN warehouses w ON w.id = p.warehouse_id
    ${where}
    ORDER BY p.fuel_type ASC, p.id ASC
  `);

  const usdRate = Math.max(config.usdToToman, 1);

  return rows.map((r) => {
    const fuelType = r.fuel_type as FuelType;
    const barrelLiters = Number(r.barrel_liters);
    const pricingMode = r.pricing_mode as "AUTO_DISCOVERY" | "MANUAL";
    const marginPercent = Number(r.margin_percent);
    const manualPrice = Number(r.manual_price_per_barrel_toman);
    const lastCost = Number(r.last_cost_per_barrel_toman ?? 0);

    let effectiveBarrelPrice = manualPrice;
    if (pricingMode === "AUTO_DISCOVERY") {
      const publishedBase =
        fuelType === "DIESEL"
          ? dieselSummary.publishedSellPerBarrelToman ||
            config.publishedDieselBarrelToman
          : config.publishedGasolineBarrelToman;
      const scaleFactor =
        fuelType === "DIESEL"
          ? barrelLiters / Math.max(config.defaultBarrelLiters, 1)
          : 1;
      effectiveBarrelPrice = roundToThousand(
        publishedBase * scaleFactor * (1 + marginPercent / 100)
      );
    }

    return {
      id: Number(r.id),
      name: String(r.name),
      sku: String(r.sku),
      fuelType,
      barrelType: String(r.barrel_type),
      barrelLiters,
      density: Number(r.density),
      warehouseId: Number(r.warehouse_id),
      warehouseName: String(r.warehouse_name),
      warehouseCity: String(r.warehouse_city),
      stockBarrels: Number(r.stock_barrels),
      reservedBarrels: Number(r.reserved_barrels),
      pricingMode,
      marginPercent,
      lastCostPerBarrelToman: lastCost,
      manualPricePerBarrelToman: manualPrice,
      effectivePricePerBarrelToman: effectiveBarrelPrice,
      effectivePricePerLiterToman: Math.round(
        effectiveBarrelPrice / Math.max(barrelLiters, 1)
      ),
      effectivePricePerBarrelUsd: Number(
        (effectiveBarrelPrice / usdRate).toFixed(2)
      ),
      minOrderBarrels: Number(r.min_order_barrels),
      isActive: Boolean(Number(r.is_active)),
      description: String(r.description),
      updatedAt: String(r.updated_at),
    };
  });
}

export async function snapshotDieselHistory(): Promise<void> {
  const db = await getDb();
  const config = await getMarketConfig();
  const summary = await getDieselDiscoverySummary(config);

  await db.run(
    `
    INSERT INTO price_history (
      weighted_avg_barrel_toman, best_buy_barrel_toman,
      published_sell_barrel_toman, usd_to_toman, source_count, recorded_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    summary.weightedAvgPerBarrelToman || summary.publishedSellPerBarrelToman,
    summary.bestBuy?.landedPerBarrelToman ?? summary.publishedSellPerBarrelToman,
    summary.publishedSellPerBarrelToman,
    config.usdToToman,
    summary.quoteCount,
    new Date().toISOString()
  );
}

export async function generateNextOrderNumber(
  tradeType: TradeType = "SALE"
): Promise<string> {
  const db = await getDb();
  const row = await db.get<{ max_id: number | string }>(
    "SELECT COALESCE(MAX(id), 0) AS max_id FROM orders"
  );
  const seq = 1001 + Number(row?.max_id ?? 0);
  const prefix = tradeType === "PURCHASE" ? "PO" : "PN";
  return `${prefix}-1405-${seq}`;
}

export async function getFullDiscoveryState() {
  const config = await getMarketConfig();
  const [sources, summary, history, warehouses, products] = await Promise.all([
    listPriceSources(),
    getDieselDiscoverySummary(config),
    listPriceHistory(20),
    listWarehouses(),
    listProductsWithPricing(false),
  ]);

  return {
    config,
    sources,
    summary,
    history,
    warehouses,
    products,
  };
}
