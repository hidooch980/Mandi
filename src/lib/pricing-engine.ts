import type {
  DieselDiscoverySummary,
  FuelType,
  MarketConfig,
  NormalizedQuote,
  PriceCurrency,
  PriceQuoteRecord,
  PriceUnit,
  VolumeTier,
} from "./types";

export const FUEL_LABELS: Record<FuelType, string> = {
  DIESEL: "گازوئیل",
  GASOLINE: "بنزین",
};

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  BROKER_PHONE: "دلال / تماس تلفنی",
  WHATSAPP: "کانال / گروه واتساپ",
  DEPOT: "انبار / بنکدار",
  EXCHANGE: "نرخ مرجع / بورس",
  API_FEED: "فید خودکار API",
};

export function currencyToTomanMultiplier(
  currency: PriceCurrency,
  config: MarketConfig
): number {
  switch (currency) {
    case "USD":
      return Math.max(config.usdToToman, 1);
    case "AED":
      return Math.max(config.aedToToman, 1);
    case "TOMAN":
    default:
      return 1;
  }
}

export function normalizeQuote(
  quote: PriceQuoteRecord,
  config: MarketConfig
): NormalizedQuote {
  const barrelLiters =
    quote.barrelLiters > 0 ? quote.barrelLiters : config.defaultBarrelLiters;
  const density = quote.density > 0 ? quote.density : config.dieselDensity;
  const multiplier = currencyToTomanMultiplier(quote.currency, config);
  const rawToman = Math.max(quote.rawPrice, 0) * multiplier;

  const litersPerTon = 1000 / Math.max(density, 0.5);
  const kgPerLiter = Math.max(density, 0.5);

  let basePerLiterToman = 0;
  switch (quote.unit as PriceUnit) {
    case "LITER":
      basePerLiterToman = rawToman;
      break;
    case "BARREL":
      basePerLiterToman = rawToman / Math.max(barrelLiters, 1);
      break;
    case "TON":
      basePerLiterToman = rawToman / litersPerTon;
      break;
    case "KG":
      basePerLiterToman = rawToman * kgPerLiter;
      break;
  }

  const basePerBarrelToman = basePerLiterToman * barrelLiters;
  const basePerTonToman = basePerLiterToman * litersPerTon;

  const barrelPackagingAddedToman = quote.includesBarrel
    ? 0
    : Math.max(config.emptyBarrelCostToman, 0) +
      Math.max(config.fillingCostToman, 0);

  const landedPerBarrelToman =
    basePerBarrelToman +
    barrelPackagingAddedToman +
    Math.max(quote.freightPerBarrelToman, 0);

  const landedPerLiterToman = landedPerBarrelToman / Math.max(barrelLiters, 1);
  const landedPerTonToman = landedPerLiterToman * litersPerTon;

  const usdRate = Math.max(config.usdToToman, 1);
  const landedPerBarrelUsd = landedPerBarrelToman / usdRate;
  const landedPerTonUsd = landedPerTonToman / usdRate;

  return {
    ...quote,
    barrelLiters,
    density,
    basePerLiterToman: Math.round(basePerLiterToman),
    basePerBarrelToman: Math.round(basePerBarrelToman),
    basePerTonToman: Math.round(basePerTonToman),
    barrelPackagingAddedToman: Math.round(barrelPackagingAddedToman),
    landedPerBarrelToman: Math.round(landedPerBarrelToman),
    landedPerLiterToman: Math.round(landedPerLiterToman),
    landedPerTonToman: Math.round(landedPerTonToman),
    landedPerBarrelUsd: Number(landedPerBarrelUsd.toFixed(2)),
    landedPerTonUsd: Number(landedPerTonUsd.toFixed(2)),
    deviationFromWeightedPercent: 0,
    isArbitrageOpportunity: false,
    isBestBuy: false,
  };
}

export function roundToThousand(value: number): number {
  return Math.round(value / 1000) * 1000;
}

export function buildVolumeTiers(
  baseSellPerBarrelToman: number,
  config: MarketConfig
): VolumeTier[] {
  const barrelLiters = Math.max(config.defaultBarrelLiters, 1);
  const usdRate = Math.max(config.usdToToman, 1);
  const tierDefs = [
    { label: "تکی / ۱ تا ۹ بشکه", minBarrels: 1, maxBarrels: 9, discountPercent: 0 },
    { label: "۱۰ تا ۲۹ بشکه", minBarrels: 10, maxBarrels: 29, discountPercent: 0.5 },
    { label: "۳۰ تا ۹۹ بشکه", minBarrels: 30, maxBarrels: 99, discountPercent: 1.0 },
    { label: "عمده ۱۰۰+ بشکه", minBarrels: 100, maxBarrels: null, discountPercent: 1.5 },
  ];

  return tierDefs.map((t) => {
    const discountedBarrel = roundToThousand(
      baseSellPerBarrelToman * (1 - t.discountPercent / 100)
    );
    return {
      ...t,
      pricePerBarrelToman: discountedBarrel,
      pricePerLiterToman: Math.round(discountedBarrel / barrelLiters),
      pricePerBarrelUsd: Number((discountedBarrel / usdRate).toFixed(2)),
    };
  });
}

/**
 * Multi-broker / WhatsApp price discovery strictly for Diesel (گازوئیل).
 */
export function discoverDieselPricing(
  rawQuotes: PriceQuoteRecord[],
  config: MarketConfig
): DieselDiscoverySummary {
  const normalized = rawQuotes
    .map((q) => normalizeQuote(q, config))
    .sort((a, b) => a.landedPerBarrelToman - b.landedPerBarrelToman);

  const published = config.publishedDieselBarrelToman;

  if (normalized.length === 0) {
    const barrelLiters = Math.max(config.defaultBarrelLiters, 1);
    const usdRate = Math.max(config.usdToToman, 1);
    return {
      fuelType: "DIESEL",
      fuelLabel: "گازوئیل",
      quoteCount: 0,
      totalAvailableBarrels: 0,
      bestBuy: null,
      highestQuote: null,
      weightedAvgPerBarrelToman: 0,
      weightedAvgPerLiterToman: 0,
      medianPerBarrelToman: 0,
      spreadPercent: 0,
      suggestedSellPerBarrelToman: published,
      suggestedSellPerLiterToman: Math.round(published / barrelLiters),
      suggestedSellPerBarrelUsd: Number((published / usdRate).toFixed(2)),
      publishedSellPerBarrelToman: published,
      estimatedProfitPerBarrelToman: 0,
      arbitrageCount: 0,
      quotes: [],
      tiers: buildVolumeTiers(published, config),
    };
  }

  let totalWeight = 0;
  let weightedSum = 0;
  let totalAvailableBarrels = 0;

  for (const q of normalized) {
    const w = Math.max(q.confidenceWeight, 1);
    totalWeight += w;
    weightedSum += q.landedPerBarrelToman * w;
    totalAvailableBarrels += Math.max(q.availableBarrels, 0);
  }

  const weightedAvgPerBarrelToman = Math.round(
    weightedSum / Math.max(totalWeight, 1)
  );
  const weightedAvgPerLiterToman = Math.round(
    weightedAvgPerBarrelToman / Math.max(config.defaultBarrelLiters, 1)
  );

  const mid = Math.floor(normalized.length / 2);
  const medianPerBarrelToman =
    normalized.length % 2 === 1
      ? normalized[mid].landedPerBarrelToman
      : Math.round(
          (normalized[mid - 1].landedPerBarrelToman +
            normalized[mid].landedPerBarrelToman) /
            2
        );

  const lowest = normalized[0];
  const highest = normalized[normalized.length - 1];
  const spreadPercent =
    lowest.landedPerBarrelToman > 0
      ? Number(
          (
            ((highest.landedPerBarrelToman - lowest.landedPerBarrelToman) /
              lowest.landedPerBarrelToman) *
            100
          ).toFixed(2)
        )
      : 0;

  let arbitrageCount = 0;
  let bestBuyAssigned = false;
  const hasAnyInventory = normalized.some((q) => q.availableBarrels > 0);

  const enrichedQuotes = normalized.map((q) => {
    const deviation =
      weightedAvgPerBarrelToman > 0
        ? Number(
            (
              ((q.landedPerBarrelToman - weightedAvgPerBarrelToman) /
                weightedAvgPerBarrelToman) *
              100
            ).toFixed(2)
          )
        : 0;
    const isArbitrage = deviation <= -1.0;
    if (isArbitrage) arbitrageCount += 1;

    let isBestBuy = false;
    if (!bestBuyAssigned && (!hasAnyInventory || q.availableBarrels > 0)) {
      isBestBuy = true;
      bestBuyAssigned = true;
    }

    return {
      ...q,
      deviationFromWeightedPercent: deviation,
      isArbitrageOpportunity: isArbitrage,
      isBestBuy,
    };
  });

  const bestBuy = enrichedQuotes.find((q) => q.isBestBuy) ?? enrichedQuotes[0];
  const highestQuote = enrichedQuotes[enrichedQuotes.length - 1];

  // If fixedProfitPerBarrelToman > 0 (e.g. +500,000 Toman per barrel), add it directly on top of Best Buy;
  // otherwise use targetMarginPercent over blended cost basis.
  const suggestedRaw =
    config.fixedProfitPerBarrelToman > 0
      ? bestBuy.landedPerBarrelToman + config.fixedProfitPerBarrelToman
      : (bestBuy.landedPerBarrelToman * 0.6 + weightedAvgPerBarrelToman * 0.4) *
        (1 + Math.max(config.targetMarginPercent, 0) / 100);

  const suggestedSellPerBarrelToman = roundToThousand(suggestedRaw);
  const suggestedSellPerLiterToman = Math.round(
    suggestedSellPerBarrelToman / Math.max(config.defaultBarrelLiters, 1)
  );
  const usdRate = Math.max(config.usdToToman, 1);
  const suggestedSellPerBarrelUsd = Number(
    (suggestedSellPerBarrelToman / usdRate).toFixed(2)
  );
  const publishedSellPerBarrelToman = published || suggestedSellPerBarrelToman;
  const estimatedProfitPerBarrelToman =
    publishedSellPerBarrelToman - bestBuy.landedPerBarrelToman;

  return {
    fuelType: "DIESEL",
    fuelLabel: "گازوئیل",
    quoteCount: enrichedQuotes.length,
    totalAvailableBarrels,
    bestBuy,
    highestQuote,
    weightedAvgPerBarrelToman,
    weightedAvgPerLiterToman,
    medianPerBarrelToman,
    spreadPercent,
    suggestedSellPerBarrelToman,
    suggestedSellPerLiterToman,
    suggestedSellPerBarrelUsd,
    publishedSellPerBarrelToman,
    estimatedProfitPerBarrelToman,
    arbitrageCount,
    quotes: enrichedQuotes,
    tiers: buildVolumeTiers(publishedSellPerBarrelToman, config),
  };
}

export function calculateOrderEconomics(params: {
  quantityBarrels: number;
  barrelLiters: number;
  density: number;
  unitPricePerBarrelToman: number;
  freightToman: number;
  discountPercent?: number;
  vatPercent: number;
  costBasisPerBarrelToman?: number;
  usdToToman: number;
  isPurchase?: boolean;
}) {
  const qty = Math.max(Math.floor(params.quantityBarrels), 0);
  const litersPerBarrel = Math.max(params.barrelLiters, 1);
  const density = Math.max(params.density, 0.5);
  const totalLiters = qty * litersPerBarrel;
  const totalTons = Number(((totalLiters * density) / 1000).toFixed(3));
  const subtotalToman = Math.round(qty * params.unitPricePerBarrelToman);
  const discountPct = params.isPurchase ? 0 : Math.max(params.discountPercent ?? 0, 0);
  const discountToman = Math.round(subtotalToman * (discountPct / 100));
  const taxableBase = Math.max(subtotalToman - discountToman, 0);
  const vatToman = Math.round(taxableBase * (Math.max(params.vatPercent, 0) / 100));
  const freightToman = Math.round(Math.max(params.freightToman, 0));
  const totalToman = taxableBase + vatToman + freightToman;
  const usdRate = Math.max(params.usdToToman, 1);
  const totalUsd = Number((totalToman / usdRate).toFixed(2));
  const costBasis = params.costBasisPerBarrelToman ?? params.unitPricePerBarrelToman;
  const estimatedCostToman = params.isPurchase
    ? totalToman
    : Math.round(qty * costBasis);
  const estimatedProfitToman = params.isPurchase
    ? 0
    : taxableBase - estimatedCostToman;

  return {
    quantityBarrels: qty,
    totalLiters,
    totalTons,
    subtotalToman,
    discountPercent: discountPct,
    discountToman,
    vatToman,
    freightToman,
    totalToman,
    totalUsd,
    estimatedCostToman,
    estimatedProfitToman,
  };
}
