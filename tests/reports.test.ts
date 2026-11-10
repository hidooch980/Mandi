import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { computeLedgerSummary } from "../src/lib/ledger.ts";
import { buildComprehensiveReport } from "../src/lib/reports.ts";
import type { ExpenseRecord, Order, Product } from "../src/lib/types";

function makeTrade(partial: Partial<Order>): Order {
  return {
    id: 1,
    orderNumber: "PN-1",
    tradeType: "SALE",
    customerId: null,
    customerName: "خریدار ۱",
    customerPhone: "09151112233",
    customerCompany: "",
    destinationCity: "زاهدان",
    deliveryAddress: "",
    status: "DELIVERED",
    paymentStatus: "PAID",
    paymentMethod: "نقدی",
    subtotalToman: 37500000,
    freightToman: 0,
    discountToman: 0,
    vatToman: 0,
    totalToman: 37500000,
    paidToman: 37500000,
    usdRateSnapshot: 68500,
    estimatedCostToman: 37000000,
    estimatedProfitToman: 500000,
    driverPlate: "",
    waybillNumber: "",
    notes: "",
    createdBy: "مدیر",
    createdAt: "2026-11-10T10:00:00.000Z",
    updatedAt: "2026-11-10T10:00:00.000Z",
    items: [
      {
        id: 1,
        orderId: 1,
        productId: 1,
        productName: "گازوئیل بشکه‌ای",
        fuelType: "DIESEL",
        barrelLiters: 220,
        density: 0.835,
        quantityBarrels: 1,
        totalLiters: 220,
        totalTons: 0.184,
        unitPriceBarrelToman: 37500000,
        lineTotalToman: 37500000,
      },
    ],
    ...partial,
  };
}

test("buildComprehensiveReport computes exact P&L, fuel split, city breakdown, and date range filtering", () => {
  const orders: Order[] = [
    // Diesel sale +500k profit on 2026-11-10
    makeTrade({ id: 1 }),
    // Gasoline 70L sale +1,000,000 profit on 2026-11-10
    makeTrade({
      id: 2,
      orderNumber: "PN-2",
      customerName: "خریدار ۲",
      customerPhone: "09153334455",
      destinationCity: "چابهار",
      totalToman: 9000000,
      paidToman: 9000000,
      estimatedCostToman: 8000000,
      estimatedProfitToman: 1000000,
      items: [
        {
          id: 2,
          orderId: 2,
          productId: 2,
          productName: "بنزین ۷۰ لیتری",
          fuelType: "GASOLINE",
          barrelLiters: 70,
          density: 0.745,
          quantityBarrels: 1,
          totalLiters: 70,
          totalTons: 0.052,
          unitPriceBarrelToman: 9000000,
          lineTotalToman: 9000000,
        },
      ],
    }),
    // Older trade outside filter range
    makeTrade({
      id: 3,
      createdAt: "2026-10-01T10:00:00.000Z",
      totalToman: 40000000,
      estimatedCostToman: 38000000,
      estimatedProfitToman: 2000000,
    }),
  ];

  const expenses: ExpenseRecord[] = [
    {
      id: 1,
      title: "اجاره جایگاه",
      category: "WAREHOUSE_RENT",
      amountToman: 400000,
      expenseDate: "2026-11-10",
      note: "",
      createdBy: "مدیر",
      createdAt: "2026-11-10T12:00:00.000Z",
    },
  ];

  const products: Product[] = [
    {
      id: 1,
      name: "گازوئیل ۲۲۰ لیتری",
      sku: "DSL-220",
      fuelType: "DIESEL",
      barrelType: "بشکه",
      barrelLiters: 220,
      density: 0.835,
      warehouseId: 1,
      warehouseName: "انبار اصلی",
      warehouseCity: "مرکزی",
      stockBarrels: 10,
      reservedBarrels: 0,
      pricingMode: "AUTO_DISCOVERY",
      marginPercent: 0,
      lastCostPerBarrelToman: 37000000,
      manualPricePerBarrelToman: 37500000,
      effectivePricePerBarrelToman: 37500000,
      effectivePricePerLiterToman: 170455,
      effectivePricePerBarrelUsd: 547.45,
      minOrderBarrels: 1,
      isActive: true,
      description: "",
      updatedAt: "2026-11-10T10:00:00.000Z",
    },
  ];

  const report = buildComprehensiveReport({
    orders,
    expenses,
    products,
    ledgerSummary: computeLedgerSummary(orders, []),
    dateFrom: "2026-11-10",
    dateTo: "2026-11-10",
  });

  assert.equal(report.pnl.salesCount, 2);
  assert.equal(report.pnl.totalSalesToman, 46500000);
  assert.equal(report.pnl.grossProfitToman, 1500000);
  assert.equal(report.pnl.totalExpensesToman, 400000);
  assert.equal(report.pnl.netProfitToman, 1100000);

  const dieselRow = report.byFuel.find((f) => f.fuelType === "DIESEL");
  const gasRow = report.byFuel.find((f) => f.fuelType === "GASOLINE");
  assert.equal(dieselRow?.grossProfitToman, 500000);
  assert.equal(gasRow?.grossProfitToman, 1000000);
  assert.equal(report.byCity.length, 2);
  assert.equal(report.totalInventoryCostToman, 370000000);
  assert.equal(report.totalInventoryRetailToman, 375000000);
});

test("expenses CRUD works cleanly on SQLite", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "petronabz-exp-"));
  process.env.PETRONABZ_DB_PATH = path.join(tempDir, "exp.db");

  const { createExpense, deleteExpense, getDb, listExpenses } = await import(
    "../src/lib/db.ts"
  );

  const afterAdd = await createExpense({
    title: "کرایه حمل بار",
    category: "FREIGHT",
    amountToman: 1200000,
    expenseDate: "2026-11-10",
    note: "ارسال تانکر",
    createdBy: "مدیر",
  });
  assert.equal(afterAdd.length, 1);
  assert.equal(afterAdd[0].amountToman, 1200000);

  const removed = await deleteExpense(afterAdd[0].id);
  assert.equal(removed, true);
  assert.equal((await listExpenses()).length, 0);

  const db = await getDb();
  await db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});
