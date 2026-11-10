import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateOrderEconomics,
  discoverDieselPricing,
  normalizeQuote,
} from "../src/lib/pricing-engine.ts";
import {
  normalizeIranPhone,
  parseSmartMessage,
  parseWhatsAppQuoteText,
} from "../src/lib/whatsapp-parser.ts";
import type { MarketConfig, PriceQuoteRecord } from "../src/lib/types.ts";

const mockConfig: MarketConfig = {
  id: 1,
  usdToToman: 68500,
  aedToToman: 18650,
  dieselDensity: 0.835,
  gasolineDensity: 0.745,
  defaultBarrelLiters: 220,
  emptyBarrelCostToman: 0,
  fillingCostToman: 0,
  vatPercent: 0,
  targetMarginPercent: 1.5,
  fixedProfitPerBarrelToman: 500000,
  publishedDieselBarrelToman: 37500000,
  publishedGasolineBarrelToman: 9000000,
  companyTitle: "تست",
  companyPhone: "0912",
  companyAddress: "تهران",
  companyEconomicCode: "",
  updatedAt: new Date().toISOString(),
};

test("discoverDieselPricing computes 37M buy + 500k fixed profit = 37.5M sell", () => {
  const now = new Date().toISOString();
  const quotes: PriceQuoteRecord[] = [
    {
      id: 1,
      sourceId: 1,
      sourceName: "دلال علی (تلفنی)",
      sourceCode: "B1",
      sourceType: "BROKER_PHONE",
      sourceCity: "انبار شرق",
      sourceContact: "09151112233",
      confidenceWeight: 90,
      fuelType: "DIESEL",
      rawPrice: 37000000,
      currency: "TOMAN",
      unit: "BARREL",
      barrelLiters: 220,
      density: 0.835,
      includesBarrel: true,
      freightPerBarrelToman: 0,
      availableBarrels: 10,
      notes: "",
      recordedBy: "تست",
      recordedAt: now,
    },
    {
      id: 2,
      sourceId: 2,
      sourceName: "کانال واتساپ سوخت",
      sourceCode: "W1",
      sourceType: "WHATSAPP",
      sourceCity: "واتساپ",
      sourceContact: "",
      confidenceWeight: 85,
      fuelType: "DIESEL",
      rawPrice: 37400000,
      currency: "TOMAN",
      unit: "BARREL",
      barrelLiters: 220,
      density: 0.835,
      includesBarrel: true,
      freightPerBarrelToman: 0,
      availableBarrels: 20,
      notes: "",
      recordedBy: "تست",
      recordedAt: now,
    },
  ];

  const summary = discoverDieselPricing(quotes, mockConfig);
  assert.equal(summary.bestBuy?.sourceName, "دلال علی (تلفنی)");
  assert.equal(summary.bestBuy?.landedPerBarrelToman, 37000000);
  assert.equal(summary.suggestedSellPerBarrelToman, 37500000);
  assert.equal(summary.estimatedProfitPerBarrelToman, 500000);
});

test("normalizeQuote handles USD/TON and TOMAN/LITER cleanly", () => {
  const quote: PriceQuoteRecord = {
    id: 3,
    sourceId: 3,
    sourceName: "انبار",
    sourceCode: "D1",
    sourceType: "DEPOT",
    sourceCity: "بندر",
    sourceContact: "",
    confidenceWeight: 90,
    fuelType: "DIESEL",
    rawPrice: 170000,
    currency: "TOMAN",
    unit: "LITER",
    barrelLiters: 220,
    density: 0.835,
    includesBarrel: true,
    freightPerBarrelToman: 0,
    availableBarrels: 50,
    notes: "",
    recordedBy: "تست",
    recordedAt: new Date().toISOString(),
  };

  const norm = normalizeQuote(quote, mockConfig);
  assert.equal(norm.landedPerBarrelToman, 37400000);
});

test("calculateOrderEconomics yields exact 500k profit on 37.5M diesel and 1M profit on 9M 70L gasoline", () => {
  const dieselSale = calculateOrderEconomics({
    quantityBarrels: 1,
    barrelLiters: 220,
    density: 0.835,
    unitPricePerBarrelToman: 37500000,
    freightToman: 0,
    vatPercent: 0,
    costBasisPerBarrelToman: 37000000,
    usdToToman: 68500,
  });
  assert.equal(dieselSale.totalToman, 37500000);
  assert.equal(dieselSale.estimatedProfitToman, 500000);

  const gas70Sale = calculateOrderEconomics({
    quantityBarrels: 1,
    barrelLiters: 70,
    density: 0.745,
    unitPricePerBarrelToman: 9000000,
    freightToman: 0,
    vatPercent: 0,
    costBasisPerBarrelToman: 8000000,
    usdToToman: 68500,
  });
  assert.equal(gas70Sale.totalLiters, 70);
  assert.equal(gas70Sale.totalToman, 9000000);
  assert.equal(gas70Sale.estimatedProfitToman, 1000000);
});

test("parseWhatsAppQuoteText extracts broker name, phone, and Persian/million price formats", () => {
  const p1 = parseWhatsAppQuoteText("آقای محمدی: گازوئیل بشکه ۳۶.۸ میلیون 09151112233");
  assert.equal(p1.suggestedSourceName, "آقای محمدی");
  assert.equal(p1.phone, "09151112233");
  assert.equal(p1.priceToman, 36800000);
  assert.equal(p1.unit, "BARREL");

  const p2 = parseWhatsAppQuoteText("کانال نرخ سوخت: گازوئیل ۳۷۵۰۰ تومان");
  assert.equal(p2.priceToman, 37500000);

  const p3 = parseSmartMessage(
    "پیام از حاج رضا\nشماره تماس +98 915 222 3344 و ۰۹۱۲-۱۱۱-۲۲۳۳\nگازوئیل ۲۵ بشکه ۲۲۰ لیتری ۳۶ و ۸۰۰ بندرعباس"
  );
  assert.deepEqual(p3.phones, ["09152223344", "09121112233"]);
  assert.equal(p3.phone, "09152223344");
  assert.equal(p3.availableBarrels, 25);
  assert.equal(p3.priceToman, 36800000);
  assert.equal(p3.city, "بندرعباس");
  assert.equal(normalizeIranPhone("0098-915-777-8899"), "09157778899");
});
