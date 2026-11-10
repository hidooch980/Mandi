import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parseCsvQuotes, SAMPLE_IMPORT_CSV } from "../src/lib/csv-importer.ts";
import { gregorianToJalali } from "../src/lib/jalali.ts";
import { hashPassword, verifyPassword } from "../src/lib/password.ts";

test("gregorianToJalali converts Nowruz and current dates accurately", () => {
  const nowruz2026 = gregorianToJalali(2026, 3, 21);
  assert.deepEqual(nowruz2026, { jy: 1405, jm: 1, jd: 1 });

  const nov10 = gregorianToJalali(2026, 11, 10);
  assert.deepEqual(nov10, { jy: 1405, jm: 8, jd: 19 });
});

test("parseCsvQuotes parses multi-broker & WhatsApp Diesel CSV sample cleanly", () => {
  const parsed = parseCsvQuotes(SAMPLE_IMPORT_CSV);
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.rows.length, 3);
  assert.equal(parsed.rows[0].sourceType, "BROKER_PHONE");
  assert.equal(parsed.rows[0].rawPrice, 36800000);
  assert.equal(parsed.rows[1].sourceType, "WHATSAPP");
  assert.equal(parsed.rows[1].rawPrice, 37000000);
});

test("password hashing and verification work with scrypt", () => {
  const hash = hashPassword("SecretDiesel#2026");
  assert.equal(verifyPassword("SecretDiesel#2026", hash), true);
  assert.equal(verifyPassword("WrongPassword", hash), false);
});

test("SQLite db initializes 37M/37.5M Diesel, 8M/9M 70L Gasoline, and broker/WhatsApp sources", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "petronabz-test-"));
  const tempDb = path.join(tempDir, "test.db");
  process.env.PETRONABZ_DB_PATH = tempDb;

  const {
    getMarketConfig,
    listBuyersWithStats,
    listOrders,
    listPriceSources,
    listSellersWithStats,
  } = await import("../src/lib/db.ts");
  const { getDieselDiscoverySummary, listProductsWithPricing } = await import(
    "../src/lib/services.ts"
  );

  const config = getMarketConfig();
  assert.equal(config.publishedDieselBarrelToman, 37500000);
  assert.equal(config.publishedGasolineBarrelToman, 9000000);

  const sources = listPriceSources();
  assert.ok(sources.some((s) => s.type === "BROKER_PHONE"));
  assert.ok(sources.some((s) => s.type === "WHATSAPP"));

  const summary = getDieselDiscoverySummary();
  assert.equal(summary.fuelType, "DIESEL");
  assert.ok(summary.quoteCount >= 5);
  assert.ok(summary.bestBuy !== null);

  const products = listProductsWithPricing(true);
  const gas70 = products.find((p) => p.fuelType === "GASOLINE");
  assert.ok(gas70);
  assert.equal(gas70.barrelLiters, 70);
  assert.equal(gas70.lastCostPerBarrelToman, 8000000);
  assert.equal(gas70.effectivePricePerBarrelToman, 9000000);

  const orders = listOrders();
  assert.ok(orders.some((o) => o.tradeType === "SALE" && o.estimatedProfitToman === 500000));
  assert.ok(orders.some((o) => o.tradeType === "SALE" && o.estimatedProfitToman === 1000000));

  const buyers = listBuyersWithStats();
  assert.ok(buyers.length >= 2);
  assert.ok(buyers.some((b) => b.totalSpentToman === 37500000));

  const sellers = listSellersWithStats();
  assert.ok(sellers.length >= 5);
  assert.ok(sellers.some((s) => s.totalPurchasedToman >= 37000000));

  const { getDb } = await import("../src/lib/db.ts");
  getDb().close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});
