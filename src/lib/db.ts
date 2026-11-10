import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { hashPassword } from "./password.ts";
import { normalizeIranPhone } from "./whatsapp-parser.ts";
import type {
  BuyerSummary,
  FuelType,
  MarketConfig,
  Order,
  OrderItem,
  OrderStatus,
  PaymentStatus,
  PriceCurrency,
  PriceHistoryPoint,
  PriceQuoteRecord,
  PriceSource,
  PriceSourceType,
  PriceUnit,
  PublicUser,
  SellerSummary,
  SmsConfig,
  SmsLogEntry,
  TradeType,
  UserRole,
  Warehouse,
} from "./types";

const globalForDb = globalThis as unknown as {
  __petronabzDb?: DatabaseSync;
  __petronabzDbPath?: string;
};

function resolveDbPath(): string {
  if (process.env.PETRONABZ_DB_PATH) {
    return process.env.PETRONABZ_DB_PATH;
  }
  return path.join(process.cwd(), "data", "petronabz-v3.db");
}

export function getDb(): DatabaseSync {
  const dbPath = resolveDbPath();
  if (globalForDb.__petronabzDb && globalForDb.__petronabzDbPath === dbPath) {
    return globalForDb.__petronabzDb;
  }

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  initializeSchema(db);
  seedDatabaseIfEmpty(db);

  globalForDb.__petronabzDb = db;
  globalForDb.__petronabzDbPath = dbPath;
  return db;
}

function initializeSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL DEFAULT '',
      company_name TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT 'تهران',
      role TEXT NOT NULL CHECK(role IN ('ADMIN','SALES','CUSTOMER')) DEFAULT 'CUSTOMER',
      password_hash TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS market_config (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      usd_to_toman REAL NOT NULL,
      aed_to_toman REAL NOT NULL,
      diesel_density REAL NOT NULL,
      gasoline_density REAL NOT NULL,
      default_barrel_liters REAL NOT NULL,
      empty_barrel_cost_toman REAL NOT NULL,
      filling_cost_toman REAL NOT NULL,
      vat_percent REAL NOT NULL,
      target_margin_percent REAL NOT NULL,
      fixed_profit_per_barrel_toman REAL NOT NULL DEFAULT 500000,
      published_diesel_barrel_toman REAL NOT NULL,
      published_gasoline_barrel_toman REAL NOT NULL,
      company_title TEXT NOT NULL,
      company_phone TEXT NOT NULL,
      company_address TEXT NOT NULL,
      company_economic_code TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS price_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL CHECK(type IN ('BROKER_PHONE','WHATSAPP','DEPOT','EXCHANGE','API_FEED')),
      city TEXT NOT NULL,
      contact_info TEXT NOT NULL DEFAULT '',
      api_url TEXT NOT NULL DEFAULT '',
      confidence_weight INTEGER NOT NULL DEFAULT 85,
      default_freight_per_barrel_toman REAL NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      is_sms_target INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sms_config (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      is_enabled INTEGER NOT NULL DEFAULT 0,
      interval_minutes INTEGER NOT NULL DEFAULT 60,
      manager_phone TEXT NOT NULL DEFAULT '09120000001',
      message_template TEXT NOT NULL,
      android_gateway_url TEXT NOT NULL DEFAULT '',
      gateway_secret TEXT NOT NULL,
      auto_discover_on_reply INTEGER NOT NULL DEFAULT 1,
      last_run_at TEXT NOT NULL DEFAULT '',
      next_run_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sms_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      direction TEXT NOT NULL CHECK(direction IN ('OUTBOUND','INBOUND')),
      source_id INTEGER REFERENCES price_sources(id) ON DELETE SET NULL,
      source_name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('QUEUED','SENT','FAILED','DISCOVERED','UNPARSED')),
      extracted_price_toman REAL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS price_quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL REFERENCES price_sources(id) ON DELETE CASCADE,
      fuel_type TEXT NOT NULL DEFAULT 'DIESEL' CHECK(fuel_type = 'DIESEL'),
      raw_price REAL NOT NULL,
      currency TEXT NOT NULL CHECK(currency IN ('TOMAN','USD','AED')),
      unit TEXT NOT NULL CHECK(unit IN ('LITER','BARREL','TON','KG')),
      barrel_liters REAL NOT NULL DEFAULT 220,
      density REAL NOT NULL DEFAULT 0.835,
      includes_barrel INTEGER NOT NULL DEFAULT 1,
      freight_per_barrel_toman REAL NOT NULL DEFAULT 0,
      available_barrels INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      recorded_by TEXT NOT NULL DEFAULT 'سیستم',
      recorded_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      weighted_avg_barrel_toman REAL NOT NULL,
      best_buy_barrel_toman REAL NOT NULL,
      published_sell_barrel_toman REAL NOT NULL,
      usd_to_toman REAL NOT NULL,
      source_count INTEGER NOT NULL,
      recorded_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS warehouses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      empty_barrels INTEGER NOT NULL DEFAULT 0,
      manager_name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sku TEXT NOT NULL UNIQUE,
      fuel_type TEXT NOT NULL CHECK(fuel_type IN ('DIESEL','GASOLINE')),
      barrel_type TEXT NOT NULL,
      barrel_liters REAL NOT NULL DEFAULT 220,
      density REAL NOT NULL DEFAULT 0.835,
      warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
      stock_barrels INTEGER NOT NULL DEFAULT 0,
      reserved_barrels INTEGER NOT NULL DEFAULT 0,
      pricing_mode TEXT NOT NULL CHECK(pricing_mode IN ('AUTO_DISCOVERY','MANUAL')) DEFAULT 'AUTO_DISCOVERY',
      margin_percent REAL NOT NULL DEFAULT 0,
      last_cost_per_barrel_toman REAL NOT NULL DEFAULT 0,
      manual_price_per_barrel_toman REAL NOT NULL DEFAULT 0,
      min_order_barrels INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      description TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      trade_type TEXT NOT NULL DEFAULT 'SALE' CHECK(trade_type IN ('SALE','PURCHASE')),
      customer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_company TEXT NOT NULL DEFAULT '',
      destination_city TEXT NOT NULL,
      delivery_address TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK(status IN ('PENDING','PROFORMA','PAID','DISPATCHED','DELIVERED','CANCELLED')),
      payment_status TEXT NOT NULL CHECK(payment_status IN ('UNPAID','PARTIAL','PAID')),
      payment_method TEXT NOT NULL DEFAULT 'کارت به کارت / نقدی',
      subtotal_toman REAL NOT NULL,
      freight_toman REAL NOT NULL DEFAULT 0,
      discount_toman REAL NOT NULL DEFAULT 0,
      vat_toman REAL NOT NULL DEFAULT 0,
      total_toman REAL NOT NULL,
      usd_rate_snapshot REAL NOT NULL,
      estimated_cost_toman REAL NOT NULL DEFAULT 0,
      estimated_profit_toman REAL NOT NULL DEFAULT 0,
      driver_plate TEXT NOT NULL DEFAULT '',
      waybill_number TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      product_name TEXT NOT NULL,
      fuel_type TEXT NOT NULL CHECK(fuel_type IN ('DIESEL','GASOLINE')),
      barrel_liters REAL NOT NULL,
      density REAL NOT NULL,
      quantity_barrels INTEGER NOT NULL,
      total_liters REAL NOT NULL,
      total_tons REAL NOT NULL,
      unit_price_barrel_toman REAL NOT NULL,
      line_total_toman REAL NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_quotes_source_time ON price_quotes(source_id, recorded_at DESC);
    CREATE INDEX IF NOT EXISTS idx_history_time ON price_history(recorded_at DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_trade_time ON orders(trade_type, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sms_logs_time ON sms_logs(created_at DESC);
  `);

  // Safe migration for existing petronabz-v3.db files missing is_sms_target column
  const cols = db
    .prepare("PRAGMA table_info(price_sources)")
    .all() as { name: string }[];
  if (!cols.some((c) => c.name === "is_sms_target")) {
    db.exec("ALTER TABLE price_sources ADD COLUMN is_sms_target INTEGER NOT NULL DEFAULT 0;");
    db.exec("UPDATE price_sources SET is_sms_target = 1 WHERE type = 'BROKER_PHONE';");
  }

  // Ensure sms_config row 1 exists
  const smsRow = db
    .prepare("SELECT id FROM sms_config WHERE id = 1")
    .get();
  if (!smsRow) {
    const now = new Date().toISOString();
    const secret = crypto.randomBytes(12).toString("hex");
    db.prepare(`
      INSERT INTO sms_config (
        id, is_enabled, interval_minutes, manager_phone, message_template,
        android_gateway_url, gateway_secret, auto_discover_on_reply,
        last_run_at, next_run_at, updated_at
      ) VALUES (1, 0, 60, '09120000001', ?, '', ?, 1, '', '', ?)
    `).run(
      "سلام {name} وقت بخیر، قیمت روز گازوئیل بشکه‌ای چند است؟ لطفاً قیمت و تعداد موجود را پیامک کنید.",
      secret,
      now
    );
  }
}

function seedDatabaseIfEmpty(db: DatabaseSync): void {
  const userCountRow = db
    .prepare("SELECT COUNT(*) AS cnt FROM users")
    .get() as { cnt: number };
  if (userCountRow.cnt > 0) return;

  const now = new Date();
  const iso = (daysAgo = 0, hoursAgo = 0) =>
    new Date(
      now.getTime() - daysAgo * 86_400_000 - hoursAgo * 3_600_000
    ).toISOString();

  // 1. Seed Staff & Sample Counterparties (no public signup)
  const insertUser = db.prepare(`
    INSERT INTO users (name, phone, email, company_name, city, role, password_hash, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
  `);
  const adminHash = hashPassword("admin1234");
  const salesHash = hashPassword("sales1234");
  const customerHash = hashPassword("client1234");

  insertUser.run(
    "مدیر سیستم",
    "09120000001",
    "admin@petronabz.ir",
    "دفتر خرید و فروش سوخت",
    "تهران",
    "ADMIN",
    adminHash,
    iso(30)
  );
  insertUser.run(
    "همکار فروش و استعلام",
    "09120000002",
    "sales@petronabz.ir",
    "دفتر خرید و فروش سوخت",
    "تهران",
    "SALES",
    salesHash,
    iso(25)
  );
  const cust1 = insertUser.run(
    "حسین بلوچی (خریدار دائمی)",
    "09151112233",
    "",
    "ناوگان حمل بار",
    "زاهدان",
    "CUSTOMER",
    customerHash,
    iso(20)
  );
  const cust2 = insertUser.run(
    "محمد ریگی (خریدار)",
    "09153334455",
    "",
    "پیمانکاری راه",
    "چابهار",
    "CUSTOMER",
    customerHash,
    iso(12)
  );

  // 2. Seed Market Config matching real trading numbers:
  // Diesel barrel ~ 37,000,000 buy -> 37,500,000 sell (+500,000 Toman/barrel)
  // Gasoline 70L ~ 8,000,000 buy -> 9,000,000 sell
  db.prepare(`
    INSERT INTO market_config (
      id, usd_to_toman, aed_to_toman, diesel_density, gasoline_density, default_barrel_liters,
      empty_barrel_cost_toman, filling_cost_toman, vat_percent, target_margin_percent,
      fixed_profit_per_barrel_toman, published_diesel_barrel_toman, published_gasoline_barrel_toman,
      company_title, company_phone, company_address, company_economic_code, updated_at
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    68500, // usdToToman
    18650, // aedToToman
    0.835, // dieselDensity
    0.745, // gasolineDensity
    220, // defaultBarrelLiters
    0, // emptyBarrelCostToman (usually included in broker barrel quotes)
    0, // fillingCostToman
    0, // vatPercent
    1.5, // targetMarginPercent
    500000, // fixedProfitPerBarrelToman (+500,000 Toman per barrel)
    37500000, // publishedDieselBarrelToman (37.5M)
    9000000, // publishedGasolineBarrelToman (9M for 70L standard unit)
    "بازرگانی خرید و فروش بنزین و گازوئیل",
    "۰۹۱۲۰۰۰۰۰۰۱",
    "محل تخلیه و بارگیری انبار مرکزی",
    "",
    iso(0, 1)
  );

  // 3. Seed Brokers (تماس تلفنی) & WhatsApp Channels (کانال واتساپ) for Diesel
  const insertSource = db.prepare(`
    INSERT INTO price_sources (
      name, code, type, city, contact_info, api_url, confidence_weight,
      default_freight_per_barrel_toman, is_active, is_sms_target, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);

  const bAli = insertSource.run(
    "دلال علی محمدی (تلفنی)",
    "BRK-ALI",
    "BROKER_PHONE",
    "انبار شرق",
    "۰۹۱۵۱۱۱۲۲۳۳",
    "",
    92,
    0,
    1,
    iso(30)
  ).lastInsertRowid;

  const waSouth = insertSource.run(
    "کانال واتساپ نرخ لحظه‌ای گازوئیل",
    "WA-DIESEL-1",
    "WHATSAPP",
    "گروه واتساپ",
    "پیام کانال واتساپ",
    "",
    90,
    0,
    0,
    iso(25)
  ).lastInsertRowid;

  const bKarimi = insertSource.run(
    "حاج حسین کریمی (استعلام تلفنی)",
    "BRK-KARIMI",
    "BROKER_PHONE",
    "مسیر بندر",
    "۰۹۱۷۲۲۲۴۴۵۵",
    "",
    88,
    0,
    1,
    iso(20)
  ).lastInsertRowid;

  const waBorder = insertSource.run(
    "گروه واتساپ بنکداران سوخت",
    "WA-BONAKDAR",
    "WHATSAPP",
    "واتساپ",
    "کانال عمده‌فروشان",
    "",
    85,
    0,
    0,
    iso(15)
  ).lastInsertRowid;

  const bReza = insertSource.run(
    "آقای رضا نارویی (تلفنی)",
    "BRK-REZA",
    "BROKER_PHONE",
    "انبار مرزی",
    "۰۹۱۵۷۷۷۸۸۹۹",
    "",
    82,
    0,
    1,
    iso(10)
  ).lastInsertRowid;

  // 4. Seed Multi-Broker / WhatsApp Diesel Quotes around 36.8M - 37.4M per barrel
  const insertQuote = db.prepare(`
    INSERT INTO price_quotes (
      source_id, fuel_type, raw_price, currency, unit, barrel_liters, density,
      includes_barrel, freight_per_barrel_toman, available_barrels, notes, recorded_by, recorded_at
    ) VALUES (?, 'DIESEL', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertQuote.run(bAli, 36800000, "TOMAN", "BARREL", 220, 0.835, 1, 0, 18, "تماس تلفنی صبح - تحویل با بشکه", "مدیر سیستم", iso(0, 3));
  insertQuote.run(waSouth, 37000000, "TOMAN", "BARREL", 220, 0.835, 1, 0, 30, "قیمت اعلامی کانال واتساپ ساعت ۱۱", "همکار فروش", iso(0, 2));
  insertQuote.run(bKarimi, 37150000, "TOMAN", "BARREL", 220, 0.835, 1, 0, 12, "تماس تلفنی - تسویه نقدی پای ماشین", "مدیر سیستم", iso(0, 2));
  insertQuote.run(waBorder, 37350000, "TOMAN", "BARREL", 220, 0.835, 1, 0, 25, "گروه واتساپ بنکداران - کرایه با خریدار", "همکار فروش", iso(0, 1));
  insertQuote.run(bReza, 37450000, "TOMAN", "BARREL", 220, 0.835, 1, 0, 10, "پیشنهاد تلفنی عصر", "مدیر سیستم", iso(0, 1));

  // 5. Seed 7-day Diesel Price Discovery History
  const insertHistory = db.prepare(`
    INSERT INTO price_history (
      weighted_avg_barrel_toman, best_buy_barrel_toman,
      published_sell_barrel_toman, usd_to_toman, source_count, recorded_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (let d = 6; d >= 0; d--) {
    const wave = Math.round(Math.sin(d * 0.9) * 250000);
    const best = 36650000 + (6 - d) * 40000 + wave;
    const avg = best + 280000;
    const pub = best + 500000;
    insertHistory.run(avg, best, pub, 68200 + (6 - d) * 50, 5, iso(d));
  }

  // 6. Seed Warehouse
  const insertWh = db.prepare(`
    INSERT INTO warehouses (name, city, address, empty_barrels, manager_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const whMain = insertWh.run(
    "انبار و جایگاه مرکزی",
    "انبار اصلی",
    "محل نگهداری بشکه‌های گازوئیل و گالن‌های ۷۰ لیتری بنزین",
    65,
    "مدیر انبار",
    iso(30)
  ).lastInsertRowid;

  // 7. Seed Exact Products matching user example:
  // - گازوئیل بشکه ۲۲۰ لیتری (خرید ۳۷ میلیون -> فروش ۳۷.۵ میلیون)
  // - بنزین ۷۰ لیتری (خرید ۸ میلیون -> فروش ۹ میلیون)
  const insertProduct = db.prepare(`
    INSERT INTO products (
      name, sku, fuel_type, barrel_type, barrel_liters, density, warehouse_id,
      stock_barrels, reserved_barrels, pricing_mode, margin_percent,
      last_cost_per_barrel_toman, manual_price_per_barrel_toman, min_order_barrels,
      is_active, description, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)
  `);

  const pDiesel = insertProduct.run(
    "گازوئیل بشکه‌ای (۲۲۰ لیتری)",
    "DSL-220",
    "DIESEL",
    "بشکه ۲۲۰ لیتری",
    220,
    0.835,
    whMain,
    24,
    0,
    "AUTO_DISCOVERY",
    0,
    37000000,
    37500000,
    "خرید مرجع حدود ۳۷ میلیون و قیمت فروش روز کشف‌شده ۳۷.۵ میلیون تومان.",
    iso(0, 1)
  ).lastInsertRowid;

  const pGasoline70 = insertProduct.run(
    "بنزین ۷۰ لیتری",
    "GAS-70L",
    "GASOLINE",
    "گالن / بشکه ۷۰ لیتری",
    70,
    0.745,
    whMain,
    35,
    0,
    "MANUAL",
    0,
    8000000,
    9000000,
    "بنزین ۷۰ لیتری — نمونه خرید ۸ میلیون و فروش ۹ میلیون تومان (سود ۱ میلیون روی هر ۷۰ لیتری).",
    iso(0, 1)
  ).lastInsertRowid;

  // 8. Seed Sample Trades matching exact user example!
  const insertOrder = db.prepare(`
    INSERT INTO orders (
      order_number, trade_type, customer_id, customer_name, customer_phone, customer_company,
      destination_city, delivery_address, status, payment_status, payment_method,
      subtotal_toman, freight_toman, discount_toman, vat_toman, total_toman,
      usd_rate_snapshot, estimated_cost_toman, estimated_profit_toman,
      driver_plate, waybill_number, notes, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO order_items (
      order_id, product_id, product_name, fuel_type, barrel_liters, density,
      quantity_barrels, total_liters, total_tons, unit_price_barrel_toman, line_total_toman
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Trade 1: Purchase 1 barrel of Diesel @ 37,000,000
  const oBuyD = insertOrder.run(
    "PO-1405-1001",
    "PURCHASE",
    null,
    "دلال علی محمدی (تلفنی)",
    "09151112233",
    "استعلام تلفنی",
    "انبار اصلی",
    "تحویل درب انبار",
    "DELIVERED",
    "PAID",
    "نقدی / کارت به کارت",
    37000000,
    0,
    0,
    0,
    37000000,
    68500,
    37000000,
    0,
    "",
    "IN-101",
    "خرید ۱ بشکه گازوئیل به قیمت ۳۷ میلیون تومان",
    "مدیر سیستم",
    iso(1, 4),
    iso(1, 4)
  ).lastInsertRowid;
  insertItem.run(oBuyD, pDiesel, "گازوئیل بشکه‌ای (۲۲۰ لیتری)", "DIESEL", 220, 0.835, 1, 220, 0.184, 37000000, 37000000);

  // Trade 2: Sell 1 barrel of Diesel @ 37,500,000 -> +500,000 profit
  const oSellD = insertOrder.run(
    "PN-1405-1002",
    "SALE",
    cust1.lastInsertRowid,
    "حسین بلوچی (خریدار دائمی)",
    "09151112233",
    "ناوگان حمل بار",
    "زاهدان",
    "تحویل حضوری",
    "DELIVERED",
    "PAID",
    "کارت به کارت",
    37500000,
    0,
    0,
    0,
    37500000,
    68500,
    37000000,
    500000,
    "",
    "OUT-201",
    "فروش ۱ بشکه گازوئیل به قیمت ۳۷,۵۰۰,۰۰۰ تومان (سود ۵۰۰ هزار تومان)",
    "مدیر سیستم",
    iso(1, 1),
    iso(1, 1)
  ).lastInsertRowid;
  insertItem.run(oSellD, pDiesel, "گازوئیل بشکه‌ای (۲۲۰ لیتری)", "DIESEL", 220, 0.835, 1, 220, 0.184, 37500000, 37500000);

  // Trade 3: Purchase 1x 70L Gasoline @ 8,000,000
  const oBuyG = insertOrder.run(
    "PO-1405-1003",
    "PURCHASE",
    null,
    "حاج حسین کریمی",
    "09172224455",
    "تامین بنزین",
    "انبار اصلی",
    "تحویل انبار",
    "DELIVERED",
    "PAID",
    "نقدی",
    8000000,
    0,
    0,
    0,
    8000000,
    68500,
    8000000,
    0,
    "",
    "IN-102",
    "خرید بنزین ۷۰ لیتری به قیمت ۸ میلیون تومان",
    "مدیر سیستم",
    iso(0, 6),
    iso(0, 6)
  ).lastInsertRowid;
  insertItem.run(oBuyG, pGasoline70, "بنزین ۷۰ لیتری", "GASOLINE", 70, 0.745, 1, 70, 0.052, 8000000, 8000000);

  // Trade 4: Sell 1x 70L Gasoline @ 9,000,000 -> +1,000,000 profit
  const oSellG = insertOrder.run(
    "PN-1405-1004",
    "SALE",
    cust2.lastInsertRowid,
    "محمد ریگی (خریدار)",
    "09153334455",
    "پیمانکاری راه",
    "چابهار",
    "تحویل حضوری",
    "DELIVERED",
    "PAID",
    "نقدی",
    9000000,
    0,
    0,
    0,
    9000000,
    68500,
    8000000,
    1000000,
    "",
    "OUT-202",
    "فروش بنزین ۷۰ لیتری به قیمت ۹ میلیون تومان (سود ۱ میلیون تومان)",
    "مدیر سیستم",
    iso(0, 2),
    iso(0, 2)
  ).lastInsertRowid;
  insertItem.run(oSellG, pGasoline70, "بنزین ۷۰ لیتری", "GASOLINE", 70, 0.745, 1, 70, 0.052, 9000000, 9000000);
}

// ==========================================
// Repository Helpers
// ==========================================

export function getMarketConfig(): MarketConfig {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM market_config WHERE id = 1")
    .get() as Record<string, unknown>;
  return {
    id: Number(row.id),
    usdToToman: Number(row.usd_to_toman),
    aedToToman: Number(row.aed_to_toman),
    dieselDensity: Number(row.diesel_density),
    gasolineDensity: Number(row.gasoline_density),
    defaultBarrelLiters: Number(row.default_barrel_liters),
    emptyBarrelCostToman: Number(row.empty_barrel_cost_toman),
    fillingCostToman: Number(row.filling_cost_toman),
    vatPercent: Number(row.vat_percent),
    targetMarginPercent: Number(row.target_margin_percent),
    fixedProfitPerBarrelToman: Number(row.fixed_profit_per_barrel_toman ?? 500000),
    publishedDieselBarrelToman: Number(row.published_diesel_barrel_toman),
    publishedGasolineBarrelToman: Number(row.published_gasoline_barrel_toman),
    companyTitle: String(row.company_title),
    companyPhone: String(row.company_phone),
    companyAddress: String(row.company_address),
    companyEconomicCode: String(row.company_economic_code ?? ""),
    updatedAt: String(row.updated_at),
  };
}

export function listPriceSources(): PriceSource[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM price_sources ORDER BY confidence_weight DESC, id ASC")
    .all() as Record<string, unknown>[];
  return rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    code: String(r.code),
    type: r.type as PriceSourceType,
    city: String(r.city),
    contactInfo: String(r.contact_info),
    apiUrl: String(r.api_url),
    confidenceWeight: Number(r.confidence_weight),
    defaultFreightPerBarrelToman: Number(r.default_freight_per_barrel_toman),
    isActive: Boolean(r.is_active),
    isSmsTarget: Boolean(r.is_sms_target),
    createdAt: String(r.created_at),
  }));
}

export function getSmsConfig(): SmsConfig {
  const db = getDb();
  const r = db
    .prepare("SELECT * FROM sms_config WHERE id = 1")
    .get() as Record<string, unknown>;
  return {
    id: Number(r.id),
    isEnabled: Boolean(r.is_enabled),
    intervalMinutes: Number(r.interval_minutes),
    managerPhone: String(r.manager_phone),
    messageTemplate: String(r.message_template),
    androidGatewayUrl: String(r.android_gateway_url),
    gatewaySecret: String(r.gateway_secret),
    autoDiscoverOnReply: Boolean(r.auto_discover_on_reply),
    lastRunAt: String(r.last_run_at),
    nextRunAt: String(r.next_run_at),
    updatedAt: String(r.updated_at),
  };
}

export function listSmsLogs(limit = 50): SmsLogEntry[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM sms_logs ORDER BY id DESC LIMIT ?")
    .all(limit) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: Number(r.id),
    direction: r.direction as "OUTBOUND" | "INBOUND",
    sourceId: r.source_id !== null ? Number(r.source_id) : null,
    sourceName: String(r.source_name),
    phone: String(r.phone),
    message: String(r.message),
    status: r.status as SmsLogEntry["status"],
    extractedPriceToman:
      r.extracted_price_toman !== null ? Number(r.extracted_price_toman) : null,
    createdAt: String(r.created_at),
  }));
}

export function listLatestPriceQuotes(includeInactive = false): PriceQuoteRecord[] {
  const db = getDb();
  const activeClause = includeInactive ? "" : "WHERE s.is_active = 1";
  const rows = db
    .prepare(`
      SELECT q.*, s.name AS source_name, s.code AS source_code, s.type AS source_type,
             s.city AS source_city, s.contact_info AS source_contact, s.confidence_weight
      FROM price_quotes q
      INNER JOIN price_sources s ON s.id = q.source_id
      INNER JOIN (
        SELECT source_id, MAX(id) AS max_id
        FROM price_quotes
        GROUP BY source_id
      ) latest ON latest.max_id = q.id
      ${activeClause}
      ORDER BY q.recorded_at DESC, q.id DESC
    `)
    .all() as Record<string, unknown>[];

  return rows.map((r) => ({
    id: Number(r.id),
    sourceId: Number(r.source_id),
    sourceName: String(r.source_name),
    sourceCode: String(r.source_code),
    sourceType: r.source_type as PriceSourceType,
    sourceCity: String(r.source_city),
    sourceContact: String(r.source_contact ?? ""),
    confidenceWeight: Number(r.confidence_weight),
    fuelType: "DIESEL",
    rawPrice: Number(r.raw_price),
    currency: r.currency as PriceCurrency,
    unit: r.unit as PriceUnit,
    barrelLiters: Number(r.barrel_liters),
    density: Number(r.density),
    includesBarrel: Boolean(r.includes_barrel),
    freightPerBarrelToman: Number(r.freight_per_barrel_toman),
    availableBarrels: Number(r.available_barrels),
    notes: String(r.notes),
    recordedBy: String(r.recorded_by),
    recordedAt: String(r.recorded_at),
  }));
}

export function listPriceHistory(limit = 30): PriceHistoryPoint[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM price_history ORDER BY recorded_at ASC, id ASC LIMIT ?")
    .all(limit) as Record<string, unknown>[];

  return rows.map((r) => ({
    id: Number(r.id),
    weightedAvgBarrelToman: Number(r.weighted_avg_barrel_toman),
    bestBuyBarrelToman: Number(r.best_buy_barrel_toman),
    publishedSellBarrelToman: Number(r.published_sell_barrel_toman),
    usdToToman: Number(r.usd_to_toman),
    sourceCount: Number(r.source_count),
    recordedAt: String(r.recorded_at),
  }));
}

export function listWarehouses(): Warehouse[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM warehouses ORDER BY id ASC")
    .all() as Record<string, unknown>[];
  return rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    city: String(r.city),
    address: String(r.address),
    emptyBarrels: Number(r.empty_barrels),
    managerName: String(r.manager_name),
    createdAt: String(r.created_at),
  }));
}

export function mapUserRow(r: Record<string, unknown>): PublicUser {
  return {
    id: Number(r.id),
    name: String(r.name),
    phone: String(r.phone),
    email: String(r.email),
    companyName: String(r.company_name),
    city: String(r.city),
    role: r.role as UserRole,
    isActive: Boolean(r.is_active),
    createdAt: String(r.created_at),
  };
}

export function listOrders(customerId?: number): Order[] {
  const db = getDb();
  const orderRows = (
    customerId !== undefined
      ? db
          .prepare("SELECT * FROM orders WHERE customer_id = ? AND trade_type = 'SALE' ORDER BY id DESC")
          .all(customerId)
      : db.prepare("SELECT * FROM orders ORDER BY id DESC").all()
  ) as Record<string, unknown>[];

  const itemRows = db
    .prepare("SELECT * FROM order_items ORDER BY id ASC")
    .all() as Record<string, unknown>[];

  const itemsByOrder = new Map<number, OrderItem[]>();
  for (const ir of itemRows) {
    const oid = Number(ir.order_id);
    const list = itemsByOrder.get(oid) ?? [];
    list.push({
      id: Number(ir.id),
      orderId: oid,
      productId: Number(ir.product_id),
      productName: String(ir.product_name),
      fuelType: ir.fuel_type as FuelType,
      barrelLiters: Number(ir.barrel_liters),
      density: Number(ir.density),
      quantityBarrels: Number(ir.quantity_barrels),
      totalLiters: Number(ir.total_liters),
      totalTons: Number(ir.total_tons),
      unitPriceBarrelToman: Number(ir.unit_price_barrel_toman),
      lineTotalToman: Number(ir.line_total_toman),
    });
    itemsByOrder.set(oid, list);
  }

  return orderRows.map((o) => ({
    id: Number(o.id),
    orderNumber: String(o.order_number),
    tradeType: (o.trade_type as TradeType) ?? "SALE",
    customerId: o.customer_id !== null ? Number(o.customer_id) : null,
    customerName: String(o.customer_name),
    customerPhone: String(o.customer_phone),
    customerCompany: String(o.customer_company),
    destinationCity: String(o.destination_city),
    deliveryAddress: String(o.delivery_address),
    status: o.status as OrderStatus,
    paymentStatus: o.payment_status as PaymentStatus,
    paymentMethod: String(o.payment_method),
    subtotalToman: Number(o.subtotal_toman),
    freightToman: Number(o.freight_toman),
    discountToman: Number(o.discount_toman),
    vatToman: Number(o.vat_toman),
    totalToman: Number(o.total_toman),
    usdRateSnapshot: Number(o.usd_rate_snapshot),
    estimatedCostToman: Number(o.estimated_cost_toman),
    estimatedProfitToman: Number(o.estimated_profit_toman),
    driverPlate: String(o.driver_plate),
    waybillNumber: String(o.waybill_number),
    notes: String(o.notes),
    createdBy: String(o.created_by),
    createdAt: String(o.created_at),
    updatedAt: String(o.updated_at),
    items: itemsByOrder.get(Number(o.id)) ?? [],
  }));
}

export function getOrderById(id: number): Order | null {
  const db = getDb();
  const o = db
    .prepare("SELECT * FROM orders WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  if (!o) return null;

  const itemRows = db
    .prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC")
    .all(id) as Record<string, unknown>[];

  return {
    id: Number(o.id),
    orderNumber: String(o.order_number),
    tradeType: (o.trade_type as TradeType) ?? "SALE",
    customerId: o.customer_id !== null ? Number(o.customer_id) : null,
    customerName: String(o.customer_name),
    customerPhone: String(o.customer_phone),
    customerCompany: String(o.customer_company),
    destinationCity: String(o.destination_city),
    deliveryAddress: String(o.delivery_address),
    status: o.status as OrderStatus,
    paymentStatus: o.payment_status as PaymentStatus,
    paymentMethod: String(o.payment_method),
    subtotalToman: Number(o.subtotal_toman),
    freightToman: Number(o.freight_toman),
    discountToman: Number(o.discount_toman),
    vatToman: Number(o.vat_toman),
    totalToman: Number(o.total_toman),
    usdRateSnapshot: Number(o.usd_rate_snapshot),
    estimatedCostToman: Number(o.estimated_cost_toman),
    estimatedProfitToman: Number(o.estimated_profit_toman),
    driverPlate: String(o.driver_plate),
    waybillNumber: String(o.waybill_number),
    notes: String(o.notes),
    createdBy: String(o.created_by),
    createdAt: String(o.created_at),
    updatedAt: String(o.updated_at),
    items: itemRows.map((ir) => ({
      id: Number(ir.id),
      orderId: Number(ir.order_id),
      productId: Number(ir.product_id),
      productName: String(ir.product_name),
      fuelType: ir.fuel_type as FuelType,
      barrelLiters: Number(ir.barrel_liters),
      density: Number(ir.density),
      quantityBarrels: Number(ir.quantity_barrels),
      totalLiters: Number(ir.total_liters),
      totalTons: Number(ir.total_tons),
      unitPriceBarrelToman: Number(ir.unit_price_barrel_toman),
      lineTotalToman: Number(ir.line_total_toman),
    })),
  };
}

export function listBuyersWithStats(): BuyerSummary[] {
  const db = getDb();
  const rows = db
    .prepare(`
      SELECT u.*,
        COALESCE((SELECT COUNT(*) FROM orders o WHERE o.customer_id = u.id AND o.trade_type = 'SALE' AND o.status != 'CANCELLED'), 0) AS order_count,
        COALESCE((SELECT SUM(o.total_toman) FROM orders o WHERE o.customer_id = u.id AND o.trade_type = 'SALE' AND o.status != 'CANCELLED'), 0) AS total_spent_toman,
        COALESCE((SELECT SUM(oi.quantity_barrels) FROM order_items oi INNER JOIN orders o ON o.id = oi.order_id WHERE o.customer_id = u.id AND o.trade_type = 'SALE' AND o.status != 'CANCELLED'), 0) AS total_barrels
      FROM users u
      WHERE u.role = 'CUSTOMER'
      ORDER BY total_spent_toman DESC, u.id DESC
    `)
    .all() as Record<string, unknown>[];

  return rows.map((r) => ({
    ...mapUserRow(r),
    orderCount: Number(r.order_count),
    totalSpentToman: Number(r.total_spent_toman),
    totalBarrels: Number(r.total_barrels),
  }));
}

export function listSellersWithStats(): SellerSummary[] {
  const sources = listPriceSources();
  const quotes = listLatestPriceQuotes(true);
  const purchaseOrders = listOrders().filter(
    (o) => o.tradeType === "PURCHASE" && o.status !== "CANCELLED"
  );

  const quoteBySourceId = new Map<number, PriceQuoteRecord>();
  for (const q of quotes) {
    quoteBySourceId.set(q.sourceId, q);
  }

  return sources.map((src) => {
    const srcPhone = normalizeIranPhone(src.contactInfo);
    const matchedPurchases = purchaseOrders.filter((o) => {
      const ordPhone = normalizeIranPhone(o.customerPhone);
      if (srcPhone.length >= 10 && ordPhone === srcPhone) return true;
      return (
        o.customerName.trim() === src.name.trim() ||
        o.customerName.includes(src.name.split("(")[0].trim())
      );
    });

    const purchaseCount = matchedPurchases.length;
    const totalPurchasedToman = matchedPurchases.reduce(
      (acc, o) => acc + o.totalToman,
      0
    );
    const totalBarrelsPurchased = matchedPurchases.reduce(
      (acc, o) =>
        acc + o.items.reduce((s, it) => s + it.quantityBarrels, 0),
      0
    );
    const latestQuote = quoteBySourceId.get(src.id);

    return {
      ...src,
      purchaseCount,
      totalPurchasedToman,
      totalBarrelsPurchased,
      latestQuoteRawPrice: latestQuote ? latestQuote.rawPrice : null,
      latestQuoteCurrency: latestQuote ? latestQuote.currency : null,
      latestQuoteUnit: latestQuote ? latestQuote.unit : null,
    };
  });
}
