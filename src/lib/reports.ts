import { formatJalaliDate } from "./jalali.ts";
import { buildPartyKey } from "./ledger.ts";
import { FUEL_LABELS } from "./pricing-engine.ts";
import type {
  CityReportRow,
  ComprehensiveReport,
  DailyReportRow,
  ExpenseCategory,
  ExpenseCategoryBreakdown,
  ExpenseRecord,
  FuelReportRow,
  FuelType,
  InventoryValuationRow,
  LedgerSummary,
  Order,
  PartyReportRow,
  Product,
} from "./types";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  FREIGHT: "کرایه حمل و باربری",
  WAREHOUSE_RENT: "اجاره انبار و جایگاه",
  SALARY: "حقوق و دستمزد",
  BARREL_PACKAGING: "بشکه خالی و بسته‌بندی",
  WASTAGE: "افت / ضایعات سوخت",
  OTHER: "سایر هزینه‌های جاری",
};

/**
 * Returns a YYYY-MM-DD key in Tehran local time (UTC+03:30) for reliable date filtering.
 */
export function getTehranDateString(isoOrDate: string | Date): string {
  if (typeof isoOrDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(isoOrDate.trim())) {
    return isoOrDate.trim();
  }
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return "1970-01-01";
  const tehran = new Date(d.getTime() + 3.5 * 3_600_000);
  const y = tehran.getUTCFullYear();
  const m = String(tehran.getUTCMonth() + 1).padStart(2, "0");
  const day = String(tehran.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function buildComprehensiveReport(params: {
  orders: Order[];
  expenses: ExpenseRecord[];
  products: Product[];
  ledgerSummary: LedgerSummary;
  dateFrom?: string;
  dateTo?: string;
}): ComprehensiveReport {
  const dateFrom = (params.dateFrom ?? "").trim();
  const dateTo = (params.dateTo ?? "").trim();

  const inRange = (dateStr: string): boolean => {
    if (dateFrom && dateStr < dateFrom) return false;
    if (dateTo && dateStr > dateTo) return false;
    return true;
  };

  const activeOrders = params.orders.filter(
    (o) => o.status !== "CANCELLED" && inRange(getTehranDateString(o.createdAt))
  );

  const filteredExpenses = params.expenses.filter((e) =>
    inRange(getTehranDateString(e.expenseDate || e.createdAt))
  );

  // Balance map by partyKey
  const balanceByKey = new Map<string, number>();
  for (const acc of params.ledgerSummary.accounts) {
    balanceByKey.set(acc.partyKey, acc.netBalanceToman);
  }

  let salesCount = 0;
  let purchasesCount = 0;
  let totalSalesToman = 0;
  let totalPurchasesToman = 0;
  let totalCostOfGoodsToman = 0;
  let totalFreightChargedToman = 0;
  let totalDiscountToman = 0;
  let grossProfitToman = 0;

  const fuelAcc = new Map<
    FuelType,
    {
      salesCount: number;
      purchasesCount: number;
      purchasedBarrels: number;
      purchasedLiters: number;
      purchasedTons: number;
      purchasedAmountToman: number;
      soldBarrels: number;
      soldLiters: number;
      soldTons: number;
      soldAmountToman: number;
      grossProfitToman: number;
    }
  >();

  for (const ft of ["DIESEL", "GASOLINE"] as FuelType[]) {
    fuelAcc.set(ft, {
      salesCount: 0,
      purchasesCount: 0,
      purchasedBarrels: 0,
      purchasedLiters: 0,
      purchasedTons: 0,
      purchasedAmountToman: 0,
      soldBarrels: 0,
      soldLiters: 0,
      soldTons: 0,
      soldAmountToman: 0,
      grossProfitToman: 0,
    });
  }

  const dailyMap = new Map<
    string,
    {
      salesCount: number;
      purchasesCount: number;
      soldBarrels: number;
      purchasedBarrels: number;
      salesToman: number;
      purchasesToman: number;
      grossProfitToman: number;
      expensesToman: number;
    }
  >();

  const ensureDay = (dateKey: string) => {
    let row = dailyMap.get(dateKey);
    if (!row) {
      row = {
        salesCount: 0,
        purchasesCount: 0,
        soldBarrels: 0,
        purchasedBarrels: 0,
        salesToman: 0,
        purchasesToman: 0,
        grossProfitToman: 0,
        expensesToman: 0,
      };
      dailyMap.set(dateKey, row);
    }
    return row;
  };

  const buyersMap = new Map<string, PartyReportRow>();
  const sellersMap = new Map<string, PartyReportRow>();
  const cityMap = new Map<string, CityReportRow>();

  for (const o of activeOrders) {
    const dayKey = getTehranDateString(o.createdAt);
    const day = ensureDay(dayKey);
    const barrels = o.items.reduce((s, it) => s + it.quantityBarrels, 0);
    const liters = o.items.reduce((s, it) => s + it.totalLiters, 0);
    const tons = o.items.reduce((s, it) => s + it.totalTons, 0);
    const mainFuel: FuelType = o.items[0]?.fuelType ?? "DIESEL";
    const fRow = fuelAcc.get(mainFuel)!;
    const pKey = buildPartyKey(o.customerName, o.customerPhone);

    if (o.tradeType === "SALE") {
      salesCount += 1;
      totalSalesToman += o.totalToman;
      totalCostOfGoodsToman += o.estimatedCostToman;
      totalFreightChargedToman += o.freightToman;
      totalDiscountToman += o.discountToman;
      grossProfitToman += o.estimatedProfitToman;

      fRow.salesCount += 1;
      fRow.soldBarrels += barrels;
      fRow.soldLiters += liters;
      fRow.soldTons += tons;
      fRow.soldAmountToman += o.totalToman;
      fRow.grossProfitToman += o.estimatedProfitToman;

      day.salesCount += 1;
      day.soldBarrels += barrels;
      day.salesToman += o.totalToman;
      day.grossProfitToman += o.estimatedProfitToman;

      const existingB = buyersMap.get(pKey) ?? {
        partyKey: pKey,
        partyName: o.customerName,
        partyPhone: o.customerPhone,
        tradeCount: 0,
        barrels: 0,
        liters: 0,
        totalToman: 0,
        grossProfitToman: 0,
        netBalanceToman: balanceByKey.get(pKey) ?? 0,
      };
      existingB.tradeCount += 1;
      existingB.barrels += barrels;
      existingB.liters += liters;
      existingB.totalToman += o.totalToman;
      existingB.grossProfitToman += o.estimatedProfitToman;
      buyersMap.set(pKey, existingB);

      const cityKey = o.destinationCity.trim() || "نامشخص";
      const existingCity = cityMap.get(cityKey) ?? {
        city: cityKey,
        salesCount: 0,
        soldBarrels: 0,
        soldLiters: 0,
        totalSalesToman: 0,
        grossProfitToman: 0,
      };
      existingCity.salesCount += 1;
      existingCity.soldBarrels += barrels;
      existingCity.soldLiters += liters;
      existingCity.totalSalesToman += o.totalToman;
      existingCity.grossProfitToman += o.estimatedProfitToman;
      cityMap.set(cityKey, existingCity);
    } else {
      purchasesCount += 1;
      totalPurchasesToman += o.totalToman;

      fRow.purchasesCount += 1;
      fRow.purchasedBarrels += barrels;
      fRow.purchasedLiters += liters;
      fRow.purchasedTons += tons;
      fRow.purchasedAmountToman += o.totalToman;

      day.purchasesCount += 1;
      day.purchasedBarrels += barrels;
      day.purchasesToman += o.totalToman;

      const existingS = sellersMap.get(pKey) ?? {
        partyKey: pKey,
        partyName: o.customerName,
        partyPhone: o.customerPhone,
        tradeCount: 0,
        barrels: 0,
        liters: 0,
        totalToman: 0,
        grossProfitToman: 0,
        netBalanceToman: balanceByKey.get(pKey) ?? 0,
      };
      existingS.tradeCount += 1;
      existingS.barrels += barrels;
      existingS.liters += liters;
      existingS.totalToman += o.totalToman;
      sellersMap.set(pKey, existingS);
    }
  }

  // Expenses breakdown
  let totalExpensesToman = 0;
  const catMap = new Map<ExpenseCategory, { amountToman: number; count: number }>();

  for (const exp of filteredExpenses) {
    totalExpensesToman += exp.amountToman;
    const prev = catMap.get(exp.category) ?? { amountToman: 0, count: 0 };
    prev.amountToman += exp.amountToman;
    prev.count += 1;
    catMap.set(exp.category, prev);

    const expDay = getTehranDateString(exp.expenseDate || exp.createdAt);
    ensureDay(expDay).expensesToman += exp.amountToman;
  }

  const expensesByCategory: ExpenseCategoryBreakdown[] = Array.from(
    catMap.entries()
  )
    .map(([category, stats]) => ({
      category,
      label: EXPENSE_CATEGORY_LABELS[category] ?? category,
      amountToman: Math.round(stats.amountToman),
      count: stats.count,
    }))
    .sort((a, b) => b.amountToman - a.amountToman);

  const netProfitToman = grossProfitToman - totalExpensesToman;
  const grossMarginPercent =
    totalSalesToman > 0 ? Number(((grossProfitToman / totalSalesToman) * 100).toFixed(2)) : 0;
  const netMarginPercent =
    totalSalesToman > 0 ? Number(((netProfitToman / totalSalesToman) * 100).toFixed(2)) : 0;

  const totalAbsFuelProfit = Array.from(fuelAcc.values()).reduce(
    (s, r) => s + Math.max(r.grossProfitToman, 0),
    0
  );

  const byFuel: FuelReportRow[] = (["DIESEL", "GASOLINE"] as FuelType[]).map(
    (ft) => {
      const f = fuelAcc.get(ft)!;
      return {
        fuelType: ft,
        label: FUEL_LABELS[ft],
        salesCount: f.salesCount,
        purchasesCount: f.purchasesCount,
        purchasedBarrels: f.purchasedBarrels,
        purchasedLiters: Math.round(f.purchasedLiters),
        purchasedTons: Number(f.purchasedTons.toFixed(3)),
        purchasedAmountToman: Math.round(f.purchasedAmountToman),
        avgBuyPerBarrelToman:
          f.purchasedBarrels > 0
            ? Math.round(f.purchasedAmountToman / f.purchasedBarrels)
            : 0,
        soldBarrels: f.soldBarrels,
        soldLiters: Math.round(f.soldLiters),
        soldTons: Number(f.soldTons.toFixed(3)),
        soldAmountToman: Math.round(f.soldAmountToman),
        avgSellPerBarrelToman:
          f.soldBarrels > 0 ? Math.round(f.soldAmountToman / f.soldBarrels) : 0,
        grossProfitToman: Math.round(f.grossProfitToman),
        profitSharePercent:
          totalAbsFuelProfit > 0
            ? Number(
                ((Math.max(f.grossProfitToman, 0) / totalAbsFuelProfit) * 100).toFixed(1)
              )
            : 0,
      };
    }
  );

  const daily: DailyReportRow[] = Array.from(dailyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([dateKey, d]) => ({
      dateKey,
      jalaliLabel: formatJalaliDate(`${dateKey}T12:00:00.000Z`),
      salesCount: d.salesCount,
      purchasesCount: d.purchasesCount,
      soldBarrels: d.soldBarrels,
      purchasedBarrels: d.purchasedBarrels,
      salesToman: Math.round(d.salesToman),
      purchasesToman: Math.round(d.purchasesToman),
      grossProfitToman: Math.round(d.grossProfitToman),
      expensesToman: Math.round(d.expensesToman),
      netProfitToman: Math.round(d.grossProfitToman - d.expensesToman),
    }));

  const topBuyers = Array.from(buyersMap.values()).sort(
    (a, b) => b.totalToman - a.totalToman
  );
  const topSellers = Array.from(sellersMap.values()).sort(
    (a, b) => b.totalToman - a.totalToman
  );
  const byCity = Array.from(cityMap.values()).sort(
    (a, b) => b.totalSalesToman - a.totalSalesToman
  );

  const inventoryValuation: InventoryValuationRow[] = params.products.map((p) => {
    const availableBarrels = Math.max(p.stockBarrels - p.reservedBarrels, 0);
    const unitCost =
      p.lastCostPerBarrelToman > 0
        ? p.lastCostPerBarrelToman
        : p.effectivePricePerBarrelToman;
    const costValuationToman = Math.round(p.stockBarrels * unitCost);
    const retailValuationToman = Math.round(
      p.stockBarrels * p.effectivePricePerBarrelToman
    );
    return {
      productId: p.id,
      name: p.name,
      fuelType: p.fuelType,
      stockBarrels: p.stockBarrels,
      reservedBarrels: p.reservedBarrels,
      availableBarrels,
      totalLiters: Math.round(p.stockBarrels * p.barrelLiters),
      costValuationToman,
      retailValuationToman,
      potentialProfitToman: retailValuationToman - costValuationToman,
    };
  });

  const totalInventoryCostToman = inventoryValuation.reduce(
    (s, r) => s + r.costValuationToman,
    0
  );
  const totalInventoryRetailToman = inventoryValuation.reduce(
    (s, r) => s + r.retailValuationToman,
    0
  );

  return {
    dateFrom,
    dateTo,
    pnl: {
      salesCount,
      purchasesCount,
      totalSalesToman: Math.round(totalSalesToman),
      totalPurchasesToman: Math.round(totalPurchasesToman),
      totalCostOfGoodsToman: Math.round(totalCostOfGoodsToman),
      totalFreightChargedToman: Math.round(totalFreightChargedToman),
      totalDiscountToman: Math.round(totalDiscountToman),
      grossProfitToman: Math.round(grossProfitToman),
      grossMarginPercent,
      totalExpensesToman: Math.round(totalExpensesToman),
      expensesByCategory,
      netProfitToman: Math.round(netProfitToman),
      netMarginPercent,
    },
    byFuel,
    daily,
    topBuyers,
    topSellers,
    byCity,
    inventoryValuation,
    totalInventoryCostToman,
    totalInventoryRetailToman,
  };
}
