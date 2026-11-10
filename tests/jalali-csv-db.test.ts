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

test("convertSqlToPg translates ? placeholders cleanly without touching string literals", async () => {
  const { convertSqlToPg } = await import("../src/lib/db.ts");

  assert.equal(
    convertSqlToPg("SELECT * FROM users WHERE phone = ? AND role = ?"),
    "SELECT * FROM users WHERE phone = $1 AND role = $2"
  );
  assert.equal(
    convertSqlToPg("SELECT 'قیمت چند است؟' AS msg, id FROM sms_logs WHERE status = ?"),
    "SELECT 'قیمت چند است؟' AS msg, id FROM sms_logs WHERE status = $1"
  );
  assert.equal(
    convertSqlToPg(
      "INSERT INTO users (name, phone) VALUES (?, ?);",
      true
    ),
    "INSERT INTO users (name, phone) VALUES ($1, $2) RETURNING id"
  );
});

test("SQLite db initializes blank production baseline with 0 sample trades/quotes and resetToCleanDatabase clears everything cleanly", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "petronabz-test-"));
  const tempDb = path.join(tempDir, "test.db");
  process.env.PETRONABZ_DB_PATH = tempDb;

  const {
    getDb,
    getMarketConfig,
    listBuyersWithStats,
    listLatestPriceQuotes,
    listOrders,
    listPriceHistory,
    listPriceSources,
    listSellersWithStats,
    resetToCleanDatabase,
  } = await import("../src/lib/db.ts");
  const { getDieselDiscoverySummary, listProductsWithPricing } = await import(
    "../src/lib/services.ts"
  );

  const config = await getMarketConfig();
  assert.equal(config.publishedDieselBarrelToman, 0);
  assert.equal(config.publishedGasolineBarrelToman, 0);

  const sources = await listPriceSources();
  assert.equal(sources.length, 0);

  const summary = await getDieselDiscoverySummary();
  assert.equal(summary.fuelType, "DIESEL");
  assert.equal(summary.quoteCount, 0);
  assert.equal(summary.bestBuy, null);

  const products = await listProductsWithPricing(true);
  assert.equal(products.length, 2);
  assert.equal(products.every((p) => p.stockBarrels === 0), true);

  const orders = await listOrders();
  assert.equal(orders.length, 0);

  const buyers = await listBuyersWithStats();
  assert.equal(buyers.length, 0);

  const sellers = await listSellersWithStats();
  assert.equal(sellers.length, 0);

  // Insert sample data then verify resetToCleanDatabase wipes it while keeping admin
  const db = await getDb();
  await db.run(
    `INSERT INTO price_sources (name, code, type, city, contact_info, api_url, confidence_weight, default_freight_per_barrel_toman, is_active, is_sms_target, created_at)
     VALUES ('فروشنده تستی', 'TST-1', 'BROKER_PHONE', 'تهران', '09121111111', '', 90, 0, 1, 1, ?)`,
    new Date().toISOString()
  );
  assert.equal((await listPriceSources()).length, 1);

  await resetToCleanDatabase({ keepAdmins: true });
  assert.equal((await listPriceSources()).length, 0);
  assert.equal((await listLatestPriceQuotes(true)).length, 0);
  assert.equal((await listPriceHistory(10)).length, 0);
  assert.equal((await listOrders()).length, 0);
  const adminCount = await db.get<{ cnt: number }>(
    "SELECT COUNT(*) AS cnt FROM users WHERE role = 'ADMIN'"
  );
  assert.equal(Number(adminCount?.cnt ?? 0), 1);

  await db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});
