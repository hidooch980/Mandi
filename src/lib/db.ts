import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { Pool, type PoolClient } from "pg";
import { buildPartyKey, computeLedgerSummary } from "./ledger.ts";
import { hashPassword } from "./password.ts";
import { normalizeIranPhone } from "./whatsapp-parser.ts";
import type {
  BuyerSummary,
  ExpenseCategory,
  ExpenseRecord,
  FuelType,
  LedgerEntry,
  LedgerEntryType,
  LedgerSummary,
  MarketConfig,
  Order,
  OrderItem,
  OrderStatus,
  PartyType,
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

export interface DbClient {
  dialect: "sqlite" | "postgres";
  get<T = Record<string, unknown>>(
    sql: string,
    ...params: unknown[]
  ): Promise<T | undefined>;
  all<T = Record<string, unknown>>(
    sql: string,
    ...params: unknown[]
  ): Promise<T[]>;
  run(
    sql: string,
    ...params: unknown[]
  ): Promise<{ lastInsertRowid: number; changes: number }>;
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

const globalForDb = globalThis as unknown as {
  __petronabzDb?: DbClient;
  __petronabzDbKey?: string;
  __petronabzDbInit?: Promise<DbClient>;
};

function resolvePostgresUrl(): string {
  if (process.env.PETRONABZ_DB_PATH) {
    return "";
  }
  return (
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    ""
  ).trim();
}

function resolveDbPath(): string {
  if (process.env.PETRONABZ_DB_PATH) {
    return process.env.PETRONABZ_DB_PATH;
  }
  return path.join(process.cwd(), "data", "petronabz-v3.db");
}

function normalizeParam(value: unknown): SQLInputValue {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "bigint" ||
    value instanceof Uint8Array
  ) {
    return value;
  }
  return String(value);
}

/**
 * Translates SQLite-style positional `?` placeholders to PostgreSQL `$1..$n`
 * while skipping `?` characters inside single-quoted string literals or
 * double-quoted identifiers. Optionally appends `RETURNING id` on INSERTs.
 */
export function convertSqlToPg(sql: string, appendReturningId = false): string {
  let out = "";
  let paramIdx = 1;
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'" && !inDouble) {
      out += ch;
      if (inSingle && sql[i + 1] === "'") {
        out += "'";
        i++;
      } else {
        inSingle = !inSingle;
      }
      continue;
    }
    if (ch === '"' && !inSingle) {
      out += ch;
      inDouble = !inDouble;
      continue;
    }
    if (ch === "?" && !inSingle && !inDouble) {
      out += `$${paramIdx++}`;
      continue;
    }
    out += ch;
  }

  if (appendReturningId) {
    const trimmed = out.trim().replace(/;+\s*$/, "");
    if (/^INSERT\s+INTO\s+/i.test(trimmed) && !/\bRETURNING\b/i.test(trimmed)) {
      return `${trimmed} RETURNING id`;
    }
    return trimmed;
  }

  return out;
}

function createSqliteClient(
  sqlite: DatabaseSync,
  onClose: () => void
): DbClient {
  let txQueue = Promise.resolve();

  const baseClient: DbClient = {
    dialect: "sqlite",
    async get<T = Record<string, unknown>>(sql: string, ...params: unknown[]) {
      const args = params.map(normalizeParam);
      return sqlite.prepare(sql).get(...args) as T | undefined;
    },
    async all<T = Record<string, unknown>>(sql: string, ...params: unknown[]) {
      const args = params.map(normalizeParam);
      return sqlite.prepare(sql).all(...args) as T[];
    },
    async run(sql: string, ...params: unknown[]) {
      const args = params.map(normalizeParam);
      const res = sqlite.prepare(sql).run(...args);
      return {
        lastInsertRowid: Number(res.lastInsertRowid ?? 0),
        changes: Number(res.changes ?? 0),
      };
    },
    async exec(sql: string) {
      sqlite.exec(sql);
    },
    async transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T> {
      let result!: T;
      let err: unknown;
      let hasErr = false;

      const next = txQueue.then(async () => {
        sqlite.exec("BEGIN IMMEDIATE");
        try {
          result = await fn(baseClient);
          sqlite.exec("COMMIT");
        } catch (e) {
          sqlite.exec("ROLLBACK");
          err = e;
          hasErr = true;
        }
      });

      txQueue = next.catch(() => {});
      await next;
      if (hasErr) throw err;
      return result;
    },
    async close() {
      onClose();
      sqlite.close();
    },
  };

  return baseClient;
}

function isPgPool(q: Pool | PoolClient): q is Pool {
  return !("release" in q);
}

function buildPgRunner(queryable: Pool | PoolClient, onClose?: () => void): DbClient {
  const execClient: DbClient = {
    dialect: "postgres",
    async get<T = Record<string, unknown>>(sql: string, ...params: unknown[]) {
      const pgSql = convertSqlToPg(sql);
      const args = params.map(normalizeParam);
      const res = await queryable.query(pgSql, args);
      return res.rows[0] as T | undefined;
    },
    async all<T = Record<string, unknown>>(sql: string, ...params: unknown[]) {
      const pgSql = convertSqlToPg(sql);
      const args = params.map(normalizeParam);
      const res = await queryable.query(pgSql, args);
      return res.rows as T[];
    },
    async run(sql: string, ...params: unknown[]) {
      const pgSql = convertSqlToPg(sql, true);
      const args = params.map(normalizeParam);
      const res = await queryable.query(pgSql, args);
      const idVal = res.rows?.[0]?.id;
      return {
        lastInsertRowid: idVal !== undefined ? Number(idVal) : 0,
        changes: Number(res.rowCount ?? 0),
      };
    },
    async exec(sql: string) {
      await queryable.query(sql);
    },
    async transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T> {
      if (isPgPool(queryable)) {
        const client = await queryable.connect();
        await client.query("BEGIN");
        try {
          const txClient = buildPgRunner(client);
          const result = await fn(txClient);
          await client.query("COMMIT");
          return result;
        } catch (err) {
          await client.query("ROLLBACK");
          throw err;
        } finally {
          client.release();
        }
      }
      // Already inside a PoolClient transaction
      return fn(execClient);
    },
    async close() {
      onClose?.();
      if (isPgPool(queryable)) {
        await queryable.end();
      }
    },
  };

  return execClient;
}

export async function getDb(): Promise<DbClient> {
  const pgUrl = resolvePostgresUrl();
  const key = pgUrl ? `pg:${pgUrl}` : `sqlite:${resolveDbPath()}`;

  if (globalForDb.__petronabzDb && globalForDb.__petronabzDbKey === key) {
    return globalForDb.__petronabzDb;
  }

  if (globalForDb.__petronabzDbInit && globalForDb.__petronabzDbKey === key) {
    return globalForDb.__petronabzDbInit;
  }

  globalForDb.__petronabzDbKey = key;

  const initPromise = (async () => {
    let client: DbClient;

    const resetGlobal = () => {
      if (globalForDb.__petronabzDbKey === key) {
        globalForDb.__petronabzDb = undefined;
        globalForDb.__petronabzDbInit = undefined;
        globalForDb.__petronabzDbKey = undefined;
      }
    };

    if (pgUrl) {
      const isLocalPg =
        pgUrl.includes("localhost") || pgUrl.includes("127.0.0.1");
      const pool = new Pool({
        connectionString: pgUrl,
        ssl: isLocalPg ? undefined : { rejectUnauthorized: false },
        max: 10,
      });
      client = buildPgRunner(pool, resetGlobal);
    } else {
      const dbPath = resolveDbPath();
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const { DatabaseSync: SqliteSync } = await import("node:sqlite");
      const sqlite = new SqliteSync(dbPath);
      sqlite.exec("PRAGMA journal_mode = WAL;");
      sqlite.exec("PRAGMA foreign_keys = ON;");
      client = createSqliteClient(sqlite, resetGlobal);
    }

    await initializeSchema(client);
    await seedDatabaseIfEmpty(client);

    globalForDb.__petronabzDb = client;
    return client;
  })();

  globalForDb.__petronabzDbInit = initPromise;

  try {
    return await initPromise;
  } catch (err) {
    if (globalForDb.__petronabzDbKey === key) {
      globalForDb.__petronabzDbInit = undefined;
      globalForDb.__petronabzDbKey = undefined;
    }
    throw err;
  }
}

async function initializeSchema(db: DbClient): Promise<void> {
  const pk =
    db.dialect === "postgres"
      ? "SERIAL PRIMARY KEY"
      : "INTEGER PRIMARY KEY AUTOINCREMENT";
  const num = db.dialect === "postgres" ? "DOUBLE PRECISION" : "REAL";
  const idOnePk =
    db.dialect === "postgres"
      ? "INTEGER PRIMARY KEY CHECK(id = 1)"
      : "INTEGER PRIMARY KEY CHECK(id = 1)";

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id ${pk},
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
      id ${idOnePk},
      usd_to_toman ${num} NOT NULL,
      aed_to_toman ${num} NOT NULL,
      diesel_density ${num} NOT NULL,
      gasoline_density ${num} NOT NULL,
      default_barrel_liters ${num} NOT NULL,
      empty_barrel_cost_toman ${num} NOT NULL,
      filling_cost_toman ${num} NOT NULL,
      vat_percent ${num} NOT NULL,
      target_margin_percent ${num} NOT NULL,
      fixed_profit_per_barrel_toman ${num} NOT NULL DEFAULT 500000,
      published_diesel_barrel_toman ${num} NOT NULL,
      published_gasoline_barrel_toman ${num} NOT NULL,
      company_title TEXT NOT NULL,
      company_phone TEXT NOT NULL,
      company_address TEXT NOT NULL,
      company_economic_code TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS price_sources (
      id ${pk},
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL CHECK(type IN ('BROKER_PHONE','WHATSAPP','DEPOT','EXCHANGE','API_FEED')),
      city TEXT NOT NULL,
      contact_info TEXT NOT NULL DEFAULT '',
      api_url TEXT NOT NULL DEFAULT '',
      confidence_weight INTEGER NOT NULL DEFAULT 85,
      default_freight_per_barrel_toman ${num} NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      is_sms_target INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sms_config (
      id ${idOnePk},
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
      id ${pk},
      direction TEXT NOT NULL CHECK(direction IN ('OUTBOUND','INBOUND')),
      source_id INTEGER REFERENCES price_sources(id) ON DELETE SET NULL,
      source_name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('QUEUED','SENT','FAILED','DISCOVERED','UNPARSED')),
      extracted_price_toman ${num},
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS price_quotes (
      id ${pk},
      source_id INTEGER NOT NULL REFERENCES price_sources(id) ON DELETE CASCADE,
      fuel_type TEXT NOT NULL DEFAULT 'DIESEL' CHECK(fuel_type = 'DIESEL'),
      raw_price ${num} NOT NULL,
      currency TEXT NOT NULL CHECK(currency IN ('TOMAN','USD','AED')),
      unit TEXT NOT NULL CHECK(unit IN ('LITER','BARREL','TON','KG')),
      barrel_liters ${num} NOT NULL DEFAULT 210,
      density ${num} NOT NULL DEFAULT 0.835,
      includes_barrel INTEGER NOT NULL DEFAULT 1,
      freight_per_barrel_toman ${num} NOT NULL DEFAULT 0,
      available_barrels INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      recorded_by TEXT NOT NULL DEFAULT 'سیستم',
      recorded_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id ${pk},
      weighted_avg_barrel_toman ${num} NOT NULL,
      best_buy_barrel_toman ${num} NOT NULL,
      published_sell_barrel_toman ${num} NOT NULL,
      usd_to_toman ${num} NOT NULL,
      source_count INTEGER NOT NULL,
      recorded_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS warehouses (
      id ${pk},
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      empty_barrels INTEGER NOT NULL DEFAULT 0,
      manager_name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id ${pk},
      name TEXT NOT NULL,
      sku TEXT NOT NULL UNIQUE,
      fuel_type TEXT NOT NULL CHECK(fuel_type IN ('DIESEL','GASOLINE')),
      barrel_type TEXT NOT NULL,
      barrel_liters ${num} NOT NULL DEFAULT 210,
      density ${num} NOT NULL DEFAULT 0.835,
      warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
      stock_barrels INTEGER NOT NULL DEFAULT 0,
      reserved_barrels INTEGER NOT NULL DEFAULT 0,
      pricing_mode TEXT NOT NULL CHECK(pricing_mode IN ('AUTO_DISCOVERY','MANUAL')) DEFAULT 'AUTO_DISCOVERY',
      margin_percent ${num} NOT NULL DEFAULT 0,
      last_cost_per_barrel_toman ${num} NOT NULL DEFAULT 0,
      manual_price_per_barrel_toman ${num} NOT NULL DEFAULT 0,
      min_order_barrels INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      description TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id ${pk},
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
      subtotal_toman ${num} NOT NULL,
      freight_toman ${num} NOT NULL DEFAULT 0,
      discount_toman ${num} NOT NULL DEFAULT 0,
      vat_toman ${num} NOT NULL DEFAULT 0,
      total_toman ${num} NOT NULL,
      paid_toman ${num} NOT NULL DEFAULT 0,
      usd_rate_snapshot ${num} NOT NULL,
      estimated_cost_toman ${num} NOT NULL DEFAULT 0,
      estimated_profit_toman ${num} NOT NULL DEFAULT 0,
      driver_plate TEXT NOT NULL DEFAULT '',
      waybill_number TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ledger_entries (
      id ${pk},
      party_key TEXT NOT NULL,
      party_type TEXT NOT NULL CHECK(party_type IN ('BUYER','SELLER','OTHER')) DEFAULT 'OTHER',
      party_name TEXT NOT NULL,
      party_phone TEXT NOT NULL DEFAULT '',
      entry_type TEXT NOT NULL CHECK(entry_type IN ('DEBIT_RECEIVABLE','CREDIT_PAYABLE','RECEIPT_IN','PAYMENT_OUT')),
      amount_toman ${num} NOT NULL,
      order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
      order_number TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id ${pk},
      title TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('FREIGHT','WAREHOUSE_RENT','SALARY','BARREL_PACKAGING','WASTAGE','OTHER')) DEFAULT 'OTHER',
      amount_toman ${num} NOT NULL,
      expense_date TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id ${pk},
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      product_name TEXT NOT NULL,
      fuel_type TEXT NOT NULL CHECK(fuel_type IN ('DIESEL','GASOLINE')),
      barrel_liters ${num} NOT NULL,
      density ${num} NOT NULL,
      quantity_barrels INTEGER NOT NULL,
      total_liters ${num} NOT NULL,
      total_tons ${num} NOT NULL,
      unit_price_barrel_toman ${num} NOT NULL,
      line_total_toman ${num} NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_quotes_source_time ON price_quotes(source_id, recorded_at DESC);
    CREATE INDEX IF NOT EXISTS idx_history_time ON price_history(recorded_at DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_trade_time ON orders(trade_type, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sms_logs_time ON sms_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ledger_party_time ON ledger_entries(party_key, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date DESC, id DESC);
  `);

  // Safe migrations for existing SQLite and PostgreSQL databases
  if (db.dialect === "sqlite") {
    const srcCols = await db.all<{ name: string }>("PRAGMA table_info(price_sources)");
    if (!srcCols.some((c) => c.name === "is_sms_target")) {
      await db.exec(
        "ALTER TABLE price_sources ADD COLUMN is_sms_target INTEGER NOT NULL DEFAULT 0;"
      );
      await db.exec(
        "UPDATE price_sources SET is_sms_target = 1 WHERE type = 'BROKER_PHONE';"
      );
    }

    const orderCols = await db.all<{ name: string }>("PRAGMA table_info(orders)");
    if (!orderCols.some((c) => c.name === "paid_toman")) {
      await db.exec(
        "ALTER TABLE orders ADD COLUMN paid_toman REAL NOT NULL DEFAULT 0;"
      );
      await db.exec(
        "UPDATE orders SET paid_toman = total_toman WHERE payment_status = 'PAID' AND paid_toman = 0;"
      );
    }
  } else {
    await db.exec(
      "ALTER TABLE price_sources ADD COLUMN IF NOT EXISTS is_sms_target INTEGER NOT NULL DEFAULT 0;"
    );
    await db.exec(
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_toman DOUBLE PRECISION NOT NULL DEFAULT 0;"
    );
    await db.exec(
      "UPDATE orders SET paid_toman = total_toman WHERE payment_status = 'PAID' AND paid_toman = 0;"
    );
  }

  // Upgrade default Diesel barrel capacity from 220L to 210L on existing databases
  await db.exec(`
    UPDATE market_config SET default_barrel_liters = 210 WHERE id = 1 AND default_barrel_liters = 220;
    UPDATE products
    SET sku = 'DSL-210',
        name = 'گازوئیل بشکه‌ای (۲۱۰ لیتری)',
        barrel_type = 'بشکه ۲۱۰ لیتری',
        barrel_liters = 210
    WHERE sku = 'DSL-220'
      AND NOT EXISTS (SELECT 1 FROM products p2 WHERE p2.sku = 'DSL-210');
  `);

  // Ensure sms_config row 1 exists safely across concurrent serverless cold starts
  const smsRow = await db.get("SELECT id FROM sms_config WHERE id = 1");
  if (!smsRow) {
    const now = new Date().toISOString();
    const secret = crypto.randomBytes(12).toString("hex");
    await db.run(
      `
      INSERT INTO sms_config (
        id, is_enabled, interval_minutes, manager_phone, message_template,
        android_gateway_url, gateway_secret, auto_discover_on_reply,
        last_run_at, next_run_at, updated_at
      ) VALUES (1, 0, 60, '09120000001', ?, '', ?, 1, '', '', ?)
      ON CONFLICT (id) DO NOTHING
      `,
      "سلام {name} وقت بخیر، قیمت روز گازوئیل بشکه‌ای چند است؟ لطفاً قیمت و تعداد موجود را پیامک کنید.",
      secret,
      now
    );
  }
}

async function insertCleanBaseline(
  tx: DbClient,
  nowIso: string,
  options: { seedAdmin: boolean }
): Promise<void> {
  if (options.seedAdmin) {
    const adminHash = hashPassword("admin1234");
    await tx.run(
      `
      INSERT INTO users (name, phone, email, company_name, city, role, password_hash, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, 'ADMIN', ?, 1, ?)
      `,
      "مدیر سیستم",
      "09120000001",
      "admin@petronabz.ir",
      "پترونبض",
      "تهران",
      adminHash,
      nowIso
    );
  }

  await tx.run("DELETE FROM market_config WHERE id = 1");
  await tx.run(
    `
    INSERT INTO market_config (
      id, usd_to_toman, aed_to_toman, diesel_density, gasoline_density, default_barrel_liters,
      empty_barrel_cost_toman, filling_cost_toman, vat_percent, target_margin_percent,
      fixed_profit_per_barrel_toman, published_diesel_barrel_toman, published_gasoline_barrel_toman,
      company_title, company_phone, company_address, company_economic_code, updated_at
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    68500,
    18650,
    0.835,
    0.745,
    210,
    0,
    0,
    0,
    0,
    500000,
    0,
    0,
    "پترونبض",
    "",
    "",
    "",
    nowIso
  );

  const whMain = (
    await tx.run(
      `
      INSERT INTO warehouses (name, city, address, empty_barrels, manager_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      "انبار اصلی",
      "انبار مرکزی",
      "",
      0,
      "",
      nowIso
    )
  ).lastInsertRowid;

  const insertProductSql = `
    INSERT INTO products (
      name, sku, fuel_type, barrel_type, barrel_liters, density, warehouse_id,
      stock_barrels, reserved_barrels, pricing_mode, margin_percent,
      last_cost_per_barrel_toman, manual_price_per_barrel_toman, min_order_barrels,
      is_active, description, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, 0, 0, 0, 1, 1, '', ?)
  `;

  await tx.run(
    insertProductSql,
    "گازوئیل بشکه‌ای (۲۱۰ لیتری)",
    "DSL-210",
    "DIESEL",
    "بشکه ۲۱۰ لیتری",
    210,
    0.835,
    whMain,
    "AUTO_DISCOVERY",
    nowIso
  );

  await tx.run(
    insertProductSql,
    "بنزین ۷۰ لیتری",
    "GAS-70L",
    "GASOLINE",
    "گالن / بشکه ۷۰ لیتری",
    70,
    0.745,
    whMain,
    "MANUAL",
    nowIso
  );
}

async function seedDatabaseIfEmpty(db: DbClient): Promise<void> {
  const existing = await db.get<{ cnt: number | string }>(
    "SELECT COUNT(*) AS cnt FROM users"
  );
  if (Number(existing?.cnt ?? 0) > 0) return;

  await db.transaction(async (tx) => {
    if (tx.dialect === "postgres") {
      await tx.exec("SELECT pg_advisory_xact_lock(9322501);");
    }

    const userCountRow = await tx.get<{ cnt: number | string }>(
      "SELECT COUNT(*) AS cnt FROM users"
    );
    if (Number(userCountRow?.cnt ?? 0) > 0) return;

    await insertCleanBaseline(tx, new Date().toISOString(), { seedAdmin: true });
  });
}

/**
 * Clears all sample/operational transactions, quotes, sources, logs, and non-admin
 * accounts while restoring a blank warehouse/product baseline.
 */
export async function resetToCleanDatabase(options?: {
  keepAdmins?: boolean;
}): Promise<void> {
  const keepAdmins = options?.keepAdmins ?? true;
  const db = await getDb();
  const nowIso = new Date().toISOString();

  await db.transaction(async (tx) => {
    await tx.exec(`
      DELETE FROM expenses;
      DELETE FROM ledger_entries;
      DELETE FROM order_items;
      DELETE FROM orders;
      DELETE FROM sms_logs;
      DELETE FROM price_quotes;
      DELETE FROM price_history;
      DELETE FROM price_sources;
      DELETE FROM products;
      DELETE FROM warehouses;
    `);

    if (keepAdmins) {
      await tx.exec("DELETE FROM users WHERE role != 'ADMIN';");
    } else {
      await tx.exec("DELETE FROM users;");
    }

    const adminRow = await tx.get<{ cnt: number | string }>(
      "SELECT COUNT(*) AS cnt FROM users WHERE role = 'ADMIN'"
    );
    const seedAdmin = Number(adminRow?.cnt ?? 0) === 0;

    await tx.run(
      "UPDATE sms_config SET is_enabled = 0, last_run_at = '', next_run_at = '', updated_at = ? WHERE id = 1",
      nowIso
    );

    await insertCleanBaseline(tx, nowIso, { seedAdmin });
  });
}

// ==========================================
// Repository Helpers
// ==========================================

export async function getMarketConfig(): Promise<MarketConfig> {
  const db = await getDb();
  const row = (await db.get<Record<string, unknown>>(
    "SELECT * FROM market_config WHERE id = 1"
  )) as Record<string, unknown>;
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

export async function listPriceSources(): Promise<PriceSource[]> {
  const db = await getDb();
  const rows = await db.all<Record<string, unknown>>(
    "SELECT * FROM price_sources ORDER BY confidence_weight DESC, id ASC"
  );
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
    isActive: Boolean(Number(r.is_active)),
    isSmsTarget: Boolean(Number(r.is_sms_target)),
    createdAt: String(r.created_at),
  }));
}

export async function getSmsConfig(): Promise<SmsConfig> {
  const db = await getDb();
  const r = (await db.get<Record<string, unknown>>(
    "SELECT * FROM sms_config WHERE id = 1"
  )) as Record<string, unknown>;
  return {
    id: Number(r.id),
    isEnabled: Boolean(Number(r.is_enabled)),
    intervalMinutes: Number(r.interval_minutes),
    managerPhone: String(r.manager_phone),
    messageTemplate: String(r.message_template),
    androidGatewayUrl: String(r.android_gateway_url),
    gatewaySecret: String(r.gateway_secret),
    autoDiscoverOnReply: Boolean(Number(r.auto_discover_on_reply)),
    lastRunAt: String(r.last_run_at),
    nextRunAt: String(r.next_run_at),
    updatedAt: String(r.updated_at),
  };
}

export async function listSmsLogs(limit = 50): Promise<SmsLogEntry[]> {
  const db = await getDb();
  const rows = await db.all<Record<string, unknown>>(
    "SELECT * FROM sms_logs ORDER BY id DESC LIMIT ?",
    limit
  );
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

export async function listLatestPriceQuotes(
  includeInactive = false
): Promise<PriceQuoteRecord[]> {
  const db = await getDb();
  const activeClause = includeInactive ? "" : "WHERE s.is_active = 1";
  const rows = await db.all<Record<string, unknown>>(`
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
  `);

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
    includesBarrel: Boolean(Number(r.includes_barrel)),
    freightPerBarrelToman: Number(r.freight_per_barrel_toman),
    availableBarrels: Number(r.available_barrels),
    notes: String(r.notes),
    recordedBy: String(r.recorded_by),
    recordedAt: String(r.recorded_at),
  }));
}

export async function listPriceHistory(limit = 30): Promise<PriceHistoryPoint[]> {
  const db = await getDb();
  const rows = await db.all<Record<string, unknown>>(
    "SELECT * FROM price_history ORDER BY recorded_at ASC, id ASC LIMIT ?",
    limit
  );

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

export async function listWarehouses(): Promise<Warehouse[]> {
  const db = await getDb();
  const rows = await db.all<Record<string, unknown>>(
    "SELECT * FROM warehouses ORDER BY id ASC"
  );
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
    isActive: Boolean(Number(r.is_active)),
    createdAt: String(r.created_at),
  };
}

export async function listOrders(customerId?: number): Promise<Order[]> {
  const db = await getDb();
  const orderRows =
    customerId !== undefined
      ? await db.all<Record<string, unknown>>(
          "SELECT * FROM orders WHERE customer_id = ? AND trade_type = 'SALE' ORDER BY id DESC",
          customerId
        )
      : await db.all<Record<string, unknown>>(
          "SELECT * FROM orders ORDER BY id DESC"
        );

  const itemRows = await db.all<Record<string, unknown>>(
    "SELECT * FROM order_items ORDER BY id ASC"
  );

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
    paidToman: Number(o.paid_toman ?? 0),
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

export async function getOrderById(id: number): Promise<Order | null> {
  const db = await getDb();
  const o = await db.get<Record<string, unknown>>(
    "SELECT * FROM orders WHERE id = ?",
    id
  );
  if (!o) return null;

  const itemRows = await db.all<Record<string, unknown>>(
    "SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC",
    id
  );

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
    paidToman: Number(o.paid_toman ?? 0),
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

export async function listBuyersWithStats(): Promise<BuyerSummary[]> {
  const db = await getDb();
  const [rows, summary] = await Promise.all([
    db.all<Record<string, unknown>>(`
      SELECT u.*,
        COALESCE((SELECT COUNT(*) FROM orders o WHERE o.customer_id = u.id AND o.trade_type = 'SALE' AND o.status != 'CANCELLED'), 0) AS order_count,
        COALESCE((SELECT SUM(o.total_toman) FROM orders o WHERE o.customer_id = u.id AND o.trade_type = 'SALE' AND o.status != 'CANCELLED'), 0) AS total_spent_toman,
        COALESCE((SELECT SUM(oi.quantity_barrels) FROM order_items oi INNER JOIN orders o ON o.id = oi.order_id WHERE o.customer_id = u.id AND o.trade_type = 'SALE' AND o.status != 'CANCELLED'), 0) AS total_barrels
      FROM users u
      WHERE u.role = 'CUSTOMER'
      ORDER BY total_spent_toman DESC, u.id DESC
    `),
    getLedgerSummary(),
  ]);

  const balanceByKey = new Map<string, number>();
  for (const acc of summary.accounts) {
    balanceByKey.set(acc.partyKey, acc.netBalanceToman);
  }

  return rows.map((r) => {
    const u = mapUserRow(r);
    const key = buildPartyKey(u.name, u.phone);
    return {
      ...u,
      orderCount: Number(r.order_count),
      totalSpentToman: Number(r.total_spent_toman),
      totalBarrels: Number(r.total_barrels),
      balanceToman: balanceByKey.get(key) ?? 0,
    };
  });
}

export async function listSellersWithStats(): Promise<SellerSummary[]> {
  const [sources, quotes, allOrders, summary] = await Promise.all([
    listPriceSources(),
    listLatestPriceQuotes(true),
    listOrders(),
    getLedgerSummary(),
  ]);
  const purchaseOrders = allOrders.filter(
    (o) => o.tradeType === "PURCHASE" && o.status !== "CANCELLED"
  );

  const quoteBySourceId = new Map<number, PriceQuoteRecord>();
  for (const q of quotes) {
    quoteBySourceId.set(q.sourceId, q);
  }

  const balanceByKey = new Map<string, number>();
  for (const acc of summary.accounts) {
    balanceByKey.set(acc.partyKey, acc.netBalanceToman);
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
    const key = buildPartyKey(src.name, src.contactInfo);

    return {
      ...src,
      purchaseCount,
      totalPurchasedToman,
      totalBarrelsPurchased,
      balanceToman: balanceByKey.get(key) ?? 0,
      latestQuoteRawPrice: latestQuote ? latestQuote.rawPrice : null,
      latestQuoteCurrency: latestQuote ? latestQuote.currency : null,
      latestQuoteUnit: latestQuote ? latestQuote.unit : null,
    };
  });
}

// ==========================================
// Accounts Receivable / Payable (بدهکار و بستانکار)
// ==========================================

export async function listLedgerEntries(limit = 150): Promise<LedgerEntry[]> {
  const db = await getDb();
  const rows = await db.all<Record<string, unknown>>(
    "SELECT * FROM ledger_entries ORDER BY id DESC LIMIT ?",
    limit
  );
  return rows.map((r) => ({
    id: Number(r.id),
    partyKey: String(r.party_key),
    partyType: r.party_type as PartyType,
    partyName: String(r.party_name),
    partyPhone: String(r.party_phone ?? ""),
    entryType: r.entry_type as LedgerEntryType,
    amountToman: Number(r.amount_toman),
    orderId: r.order_id !== null ? Number(r.order_id) : null,
    orderNumber: String(r.order_number ?? ""),
    note: String(r.note ?? ""),
    createdBy: String(r.created_by ?? ""),
    createdAt: String(r.created_at),
  }));
}

export async function getLedgerSummary(): Promise<LedgerSummary> {
  const [orders, entries] = await Promise.all([
    listOrders(),
    listLedgerEntries(300),
  ]);
  return computeLedgerSummary(orders, entries);
}

export async function recordLedgerEntry(params: {
  partyType: PartyType;
  partyName: string;
  partyPhone: string;
  entryType: LedgerEntryType;
  amountToman: number;
  note?: string;
  createdBy: string;
}): Promise<LedgerSummary> {
  const db = await getDb();
  const cleanName = params.partyName.trim();
  const cleanPhone = params.partyPhone.trim();
  const partyKey = buildPartyKey(cleanName, cleanPhone);
  const amount = Math.round(params.amountToman);
  const nowIso = new Date().toISOString();

  await db.transaction(async (tx) => {
    const insertSql = `
      INSERT INTO ledger_entries (
        party_key, party_type, party_name, party_phone,
        entry_type, amount_toman, order_id, order_number, note, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    if (
      params.entryType === "RECEIPT_IN" ||
      params.entryType === "PAYMENT_OUT"
    ) {
      const targetTradeType: TradeType =
        params.entryType === "RECEIPT_IN" ? "SALE" : "PURCHASE";

      const candidateOrders = await tx.all<Record<string, unknown>>(
        `SELECT id, order_number, customer_name, customer_phone, total_toman, paid_toman, payment_status
         FROM orders
         WHERE trade_type = ? AND status != 'CANCELLED' AND paid_toman < total_toman
         ORDER BY id ASC`,
        targetTradeType
      );

      let remaining = amount;
      for (const ord of candidateOrders) {
        if (remaining <= 0) break;
        const ordKey = buildPartyKey(
          String(ord.customer_name),
          String(ord.customer_phone)
        );
        if (ordKey !== partyKey) continue;

        const total = Math.round(Number(ord.total_toman));
        const paid =
          Number(ord.paid_toman ?? 0) > 0
            ? Math.round(Number(ord.paid_toman))
            : ord.payment_status === "PAID"
              ? total
              : 0;
        const owed = Math.max(total - paid, 0);
        if (owed <= 0) continue;

        const applied = Math.min(remaining, owed);
        const nextPaid = Math.min(paid + applied, total);
        const nextPaymentStatus: PaymentStatus =
          nextPaid >= total ? "PAID" : nextPaid > 0 ? "PARTIAL" : "UNPAID";

        await tx.run(
          "UPDATE orders SET paid_toman = ?, payment_status = ?, updated_at = ? WHERE id = ?",
          nextPaid,
          nextPaymentStatus,
          nowIso,
          Number(ord.id)
        );

        await tx.run(
          insertSql,
          partyKey,
          params.partyType,
          cleanName,
          cleanPhone,
          params.entryType,
          applied,
          Number(ord.id),
          String(ord.order_number),
          (params.note ?? "").trim() ||
            `تسویه سند ${String(ord.order_number)}`,
          params.createdBy,
          nowIso
        );

        remaining -= applied;
      }

      if (remaining > 0) {
        await tx.run(
          insertSql,
          partyKey,
          params.partyType,
          cleanName,
          cleanPhone,
          params.entryType,
          remaining,
          null,
          "",
          (params.note ?? "").trim(),
          params.createdBy,
          nowIso
        );
      }
    } else {
      await tx.run(
        insertSql,
        partyKey,
        params.partyType,
        cleanName,
        cleanPhone,
        params.entryType,
        amount,
        null,
        "",
        (params.note ?? "").trim(),
        params.createdBy,
        nowIso
      );
    }
  });

  return getLedgerSummary();
}

export async function deleteLedgerEntry(entryId: number): Promise<boolean> {
  const db = await getDb();
  let deleted = false;

  await db.transaction(async (tx) => {
    const entry = await tx.get<Record<string, unknown>>(
      "SELECT * FROM ledger_entries WHERE id = ?",
      entryId
    );
    if (!entry) return;

    if (entry.order_id !== null) {
      const orderId = Number(entry.order_id);
      const ord = await tx.get<Record<string, unknown>>(
        "SELECT total_toman, paid_toman FROM orders WHERE id = ?",
        orderId
      );
      if (ord) {
        const nextPaid = Math.max(
          0,
          Math.round(Number(ord.paid_toman ?? 0) - Number(entry.amount_toman))
        );
        const total = Math.round(Number(ord.total_toman));
        const nextPaymentStatus: PaymentStatus =
          nextPaid >= total ? "PAID" : nextPaid > 0 ? "PARTIAL" : "UNPAID";
        await tx.run(
          "UPDATE orders SET paid_toman = ?, payment_status = ?, updated_at = ? WHERE id = ?",
          nextPaid,
          nextPaymentStatus,
          new Date().toISOString(),
          orderId
        );
      }
    }

    const res = await tx.run("DELETE FROM ledger_entries WHERE id = ?", entryId);
    deleted = res.changes > 0;
  });

  return deleted;
}

// ==========================================
// Operating Expenses (هزینه‌های جاری و سود و زیان)
// ==========================================

export async function listExpenses(limit = 300): Promise<ExpenseRecord[]> {
  const db = await getDb();
  const rows = await db.all<Record<string, unknown>>(
    "SELECT * FROM expenses ORDER BY expense_date DESC, id DESC LIMIT ?",
    limit
  );
  return rows.map((r) => ({
    id: Number(r.id),
    title: String(r.title),
    category: r.category as ExpenseCategory,
    amountToman: Number(r.amount_toman),
    expenseDate: String(r.expense_date),
    note: String(r.note ?? ""),
    createdBy: String(r.created_by ?? ""),
    createdAt: String(r.created_at),
  }));
}

export async function createExpense(params: {
  title: string;
  category: ExpenseCategory;
  amountToman: number;
  expenseDate: string;
  note?: string;
  createdBy: string;
}): Promise<ExpenseRecord[]> {
  const db = await getDb();
  await db.run(
    `INSERT INTO expenses (title, category, amount_toman, expense_date, note, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    params.title.trim(),
    params.category,
    Math.round(params.amountToman),
    params.expenseDate.trim(),
    (params.note ?? "").trim(),
    params.createdBy,
    new Date().toISOString()
  );
  return listExpenses();
}

export async function deleteExpense(id: number): Promise<boolean> {
  const db = await getDb();
  const res = await db.run("DELETE FROM expenses WHERE id = ?", id);
  return res.changes > 0;
}
