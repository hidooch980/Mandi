import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildPartyKey, computeLedgerSummary } from "../src/lib/ledger.ts";
import type { LedgerEntry, Order } from "../src/lib/types";

function makeOrder(partial: Partial<Order>): Order {
  return {
    id: 1,
    orderNumber: "PN-1405-1001",
    tradeType: "SALE",
    customerId: null,
    customerName: "حسین بلوچی",
    customerPhone: "09151112233",
    customerCompany: "",
    destinationCity: "زاهدان",
    deliveryAddress: "",
    status: "PROFORMA",
    paymentStatus: "UNPAID",
    paymentMethod: "نسیه",
    subtotalToman: 37500000,
    freightToman: 0,
    discountToman: 0,
    vatToman: 0,
    totalToman: 37500000,
    paidToman: 0,
    usdRateSnapshot: 68500,
    estimatedCostToman: 37000000,
    estimatedProfitToman: 500000,
    driverPlate: "",
    waybillNumber: "",
    notes: "",
    createdBy: "مدیر",
    createdAt: "2026-11-10T10:00:00.000Z",
    updatedAt: "2026-11-10T10:00:00.000Z",
    items: [],
    ...partial,
  };
}

test("buildPartyKey normalizes Persian/country-code Iranian phone numbers identically", () => {
  assert.equal(
    buildPartyKey("حسین", "+98 915 111 2233"),
    "phone:09151112233"
  );
  assert.equal(buildPartyKey("حسین بلوچی", "۰۹۱۵۱۱۱۲۲۳۳"), "phone:09151112233");
});

test("computeLedgerSummary tracks debtors, creditors, partial payments, and skips order-allocated entries from double counting", () => {
  const orders: Order[] = [
    // Buyer 1 owes 37.5M - 10M = 27.5M
    makeOrder({
      id: 1,
      orderNumber: "PN-1001",
      tradeType: "SALE",
      customerName: "حسین بلوچی",
      customerPhone: "09151112233",
      totalToman: 37500000,
      paidToman: 10000000,
      paymentStatus: "PARTIAL",
    }),
    // Cancelled sale must be ignored
    makeOrder({
      id: 2,
      orderNumber: "PN-1002",
      tradeType: "SALE",
      customerName: "حسین بلوچی",
      customerPhone: "09151112233",
      status: "CANCELLED",
      totalToman: 50000000,
      paidToman: 0,
    }),
    // Seller 1 is owed 37M (creditor)
    makeOrder({
      id: 3,
      orderNumber: "PO-1001",
      tradeType: "PURCHASE",
      customerName: "دلال علی",
      customerPhone: "09172224455",
      totalToman: 37000000,
      paidToman: 0,
      paymentStatus: "UNPAID",
    }),
  ];

  const entries: LedgerEntry[] = [
    // Audit entry linked to order 1 must NOT double-subtract from 27.5M
    {
      id: 10,
      partyKey: "phone:09151112233",
      partyType: "BUYER",
      partyName: "حسین بلوچی",
      partyPhone: "09151112233",
      entryType: "RECEIPT_IN",
      amountToman: 10000000,
      orderId: 1,
      orderNumber: "PN-1001",
      note: "پیش‌پرداخت",
      createdBy: "مدیر",
      createdAt: "2026-11-10T11:00:00.000Z",
    },
    // Standalone manual receivable for driver/other: +3,000,000 debtor
    {
      id: 11,
      partyKey: "name:راننده اکبری",
      partyType: "OTHER",
      partyName: "راننده اکبری",
      partyPhone: "",
      entryType: "DEBIT_RECEIVABLE",
      amountToman: 3000000,
      orderId: null,
      orderNumber: "",
      note: "مساعده بارگیری",
      createdBy: "مدیر",
      createdAt: "2026-11-10T12:00:00.000Z",
    },
  ];

  const summary = computeLedgerSummary(orders, entries);
  assert.equal(summary.debtorCount, 2);
  assert.equal(summary.creditorCount, 1);
  assert.equal(summary.totalDebtorsToman, 30500000);
  assert.equal(summary.totalCreditorsToman, 37000000);
  assert.equal(summary.netPositionToman, -6500000);
});

test("recordLedgerEntry allocates receipts onto unpaid orders and deleteLedgerEntry reverses cleanly", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "petronabz-ledger-"));
  process.env.PETRONABZ_DB_PATH = path.join(tempDir, "ledger.db");

  const {
    deleteLedgerEntry,
    getDb,
    getLedgerSummary,
    getOrderById,
    recordLedgerEntry,
  } = await import("../src/lib/db.ts");

  const db = await getDb();
  const now = new Date().toISOString();
  const orderRes = await db.run(
    `INSERT INTO orders (
      order_number, trade_type, customer_id, customer_name, customer_phone, customer_company,
      destination_city, delivery_address, status, payment_status, payment_method,
      subtotal_toman, freight_toman, discount_toman, vat_toman, total_toman, paid_toman,
      usd_rate_snapshot, estimated_cost_toman, estimated_profit_toman,
      driver_plate, waybill_number, notes, created_by, created_at, updated_at
    ) VALUES ('PN-999', 'SALE', NULL, 'خریدار آزمایشی', '09159990000', '', 'تهران', '', 'PROFORMA', 'UNPAID', 'نسیه', 20000000, 0, 0, 0, 20000000, 0, 68500, 18000000, 2000000, '', '', '', 'مدیر', ?, ?)`,
    now,
    now
  );
  const oid = Number(orderRes.lastInsertRowid);

  // Pay 15M of 20M -> order becomes PARTIAL (paid 15M), remaining debtor 5M
  const afterPartial = await recordLedgerEntry({
    partyType: "BUYER",
    partyName: "خریدار آزمایشی",
    partyPhone: "09159990000",
    entryType: "RECEIPT_IN",
    amountToman: 15000000,
    note: "قسط اول",
    createdBy: "مدیر",
  });
  assert.equal(afterPartial.totalDebtorsToman, 5000000);
  const ordAfter = await getOrderById(oid);
  assert.equal(ordAfter?.paidToman, 15000000);
  assert.equal(ordAfter?.paymentStatus, "PARTIAL");

  // Delete that receipt -> reverses order back to UNPAID (paid 0), debtor 20M
  const entryId = afterPartial.entries[0].id;
  const deleted = await deleteLedgerEntry(entryId);
  assert.equal(deleted, true);

  const summaryReversed = await getLedgerSummary();
  assert.equal(summaryReversed.totalDebtorsToman, 20000000);
  const ordReversed = await getOrderById(oid);
  assert.equal(ordReversed?.paidToman, 0);
  assert.equal(ordReversed?.paymentStatus, "UNPAID");

  await db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});
