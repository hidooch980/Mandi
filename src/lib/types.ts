export type UserRole = "ADMIN" | "SALES" | "CUSTOMER";

export type FuelType = "DIESEL" | "GASOLINE";

export type TradeType = "SALE" | "PURCHASE";

export type PriceSourceType =
  | "BROKER_PHONE"
  | "WHATSAPP"
  | "DEPOT"
  | "EXCHANGE"
  | "API_FEED";

export type PriceCurrency = "TOMAN" | "USD" | "AED";

export type PriceUnit = "LITER" | "BARREL" | "TON" | "KG";

export type OrderStatus =
  | "PENDING"
  | "PROFORMA"
  | "PAID"
  | "DISPATCHED"
  | "DELIVERED"
  | "CANCELLED";

export type PaymentStatus = "UNPAID" | "PARTIAL" | "PAID";

export interface PublicUser {
  id: number;
  name: string;
  phone: string;
  email: string;
  companyName: string;
  city: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface MarketConfig {
  id: number;
  usdToToman: number;
  aedToToman: number;
  dieselDensity: number;
  gasolineDensity: number;
  defaultBarrelLiters: number;
  emptyBarrelCostToman: number;
  fillingCostToman: number;
  vatPercent: number;
  targetMarginPercent: number;
  fixedProfitPerBarrelToman: number;
  publishedDieselBarrelToman: number;
  publishedGasolineBarrelToman: number;
  companyTitle: string;
  companyPhone: string;
  companyAddress: string;
  companyEconomicCode: string;
  updatedAt: string;
}

export interface PriceSource {
  id: number;
  name: string;
  code: string;
  type: PriceSourceType;
  city: string;
  contactInfo: string;
  apiUrl: string;
  confidenceWeight: number;
  defaultFreightPerBarrelToman: number;
  isActive: boolean;
  isSmsTarget: boolean;
  createdAt: string;
}

export interface SmsConfig {
  id: number;
  isEnabled: boolean;
  intervalMinutes: number;
  managerPhone: string;
  messageTemplate: string;
  androidGatewayUrl: string;
  gatewaySecret: string;
  autoDiscoverOnReply: boolean;
  lastRunAt: string;
  nextRunAt: string;
  updatedAt: string;
}

export interface SmsLogEntry {
  id: number;
  direction: "OUTBOUND" | "INBOUND";
  sourceId: number | null;
  sourceName: string;
  phone: string;
  message: string;
  status: "QUEUED" | "SENT" | "FAILED" | "DISCOVERED" | "UNPARSED";
  extractedPriceToman: number | null;
  createdAt: string;
}

export interface PriceQuoteRecord {
  id: number;
  sourceId: number;
  sourceName: string;
  sourceCode: string;
  sourceType: PriceSourceType;
  sourceCity: string;
  sourceContact: string;
  confidenceWeight: number;
  fuelType: "DIESEL";
  rawPrice: number;
  currency: PriceCurrency;
  unit: PriceUnit;
  barrelLiters: number;
  density: number;
  includesBarrel: boolean;
  freightPerBarrelToman: number;
  availableBarrels: number;
  notes: string;
  recordedBy: string;
  recordedAt: string;
}

export interface NormalizedQuote extends PriceQuoteRecord {
  basePerLiterToman: number;
  basePerBarrelToman: number;
  basePerTonToman: number;
  barrelPackagingAddedToman: number;
  landedPerBarrelToman: number;
  landedPerLiterToman: number;
  landedPerTonToman: number;
  landedPerBarrelUsd: number;
  landedPerTonUsd: number;
  deviationFromWeightedPercent: number;
  isArbitrageOpportunity: boolean;
  isBestBuy: boolean;
}

export interface VolumeTier {
  label: string;
  minBarrels: number;
  maxBarrels: number | null;
  discountPercent: number;
  pricePerBarrelToman: number;
  pricePerLiterToman: number;
  pricePerBarrelUsd: number;
}

export interface DieselDiscoverySummary {
  fuelType: "DIESEL";
  fuelLabel: string;
  quoteCount: number;
  totalAvailableBarrels: number;
  bestBuy: NormalizedQuote | null;
  highestQuote: NormalizedQuote | null;
  weightedAvgPerBarrelToman: number;
  weightedAvgPerLiterToman: number;
  medianPerBarrelToman: number;
  spreadPercent: number;
  suggestedSellPerBarrelToman: number;
  suggestedSellPerLiterToman: number;
  suggestedSellPerBarrelUsd: number;
  publishedSellPerBarrelToman: number;
  estimatedProfitPerBarrelToman: number;
  arbitrageCount: number;
  quotes: NormalizedQuote[];
  tiers: VolumeTier[];
}

export interface PriceHistoryPoint {
  id: number;
  weightedAvgBarrelToman: number;
  bestBuyBarrelToman: number;
  publishedSellBarrelToman: number;
  usdToToman: number;
  sourceCount: number;
  recordedAt: string;
}

export interface Warehouse {
  id: number;
  name: string;
  city: string;
  address: string;
  emptyBarrels: number;
  managerName: string;
  createdAt: string;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  fuelType: FuelType;
  barrelType: string;
  barrelLiters: number;
  density: number;
  warehouseId: number;
  warehouseName: string;
  warehouseCity: string;
  stockBarrels: number;
  reservedBarrels: number;
  pricingMode: "AUTO_DISCOVERY" | "MANUAL";
  marginPercent: number;
  lastCostPerBarrelToman: number;
  manualPricePerBarrelToman: number;
  effectivePricePerBarrelToman: number;
  effectivePricePerLiterToman: number;
  effectivePricePerBarrelUsd: number;
  minOrderBarrels: number;
  isActive: boolean;
  description: string;
  updatedAt: string;
}

export interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  productName: string;
  fuelType: FuelType;
  barrelLiters: number;
  density: number;
  quantityBarrels: number;
  totalLiters: number;
  totalTons: number;
  unitPriceBarrelToman: number;
  lineTotalToman: number;
}

export interface Order {
  id: number;
  orderNumber: string;
  tradeType: TradeType;
  customerId: number | null;
  customerName: string;
  customerPhone: string;
  customerCompany: string;
  destinationCity: string;
  deliveryAddress: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  subtotalToman: number;
  freightToman: number;
  discountToman: number;
  vatToman: number;
  totalToman: number;
  paidToman: number;
  usdRateSnapshot: number;
  estimatedCostToman: number;
  estimatedProfitToman: number;
  driverPlate: string;
  waybillNumber: string;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

export interface BuyerSummary extends PublicUser {
  orderCount: number;
  totalSpentToman: number;
  totalBarrels: number;
  balanceToman: number;
}

export interface SellerSummary extends PriceSource {
  purchaseCount: number;
  totalPurchasedToman: number;
  totalBarrelsPurchased: number;
  balanceToman: number;
  latestQuoteRawPrice: number | null;
  latestQuoteCurrency: PriceCurrency | null;
  latestQuoteUnit: PriceUnit | null;
}

export type PartyType = "BUYER" | "SELLER" | "OTHER";

export type LedgerEntryType =
  | "DEBIT_RECEIVABLE"
  | "CREDIT_PAYABLE"
  | "RECEIPT_IN"
  | "PAYMENT_OUT";

export interface LedgerEntry {
  id: number;
  partyKey: string;
  partyType: PartyType;
  partyName: string;
  partyPhone: string;
  entryType: LedgerEntryType;
  amountToman: number;
  orderId: number | null;
  orderNumber: string;
  note: string;
  createdBy: string;
  createdAt: string;
}

export interface PartyAccountSummary {
  partyKey: string;
  partyType: PartyType;
  partyName: string;
  partyPhone: string;
  salesCount: number;
  purchasesCount: number;
  totalReceivableToman: number;
  totalPayableToman: number;
  /** >0: بدهکار به ما (طلب ما) | <0: بستانکار از ما (بدهی ما) | 0: تسویه */
  netBalanceToman: number;
  lastActivityAt: string;
}

export interface LedgerSummary {
  accounts: PartyAccountSummary[];
  entries: LedgerEntry[];
  totalDebtorsToman: number;
  totalCreditorsToman: number;
  debtorCount: number;
  creditorCount: number;
  netPositionToman: number;
}

export type ExpenseCategory =
  | "FREIGHT"
  | "WAREHOUSE_RENT"
  | "SALARY"
  | "BARREL_PACKAGING"
  | "WASTAGE"
  | "OTHER";

export interface ExpenseRecord {
  id: number;
  title: string;
  category: ExpenseCategory;
  amountToman: number;
  expenseDate: string;
  note: string;
  createdBy: string;
  createdAt: string;
}

export interface ExpenseCategoryBreakdown {
  category: ExpenseCategory;
  label: string;
  amountToman: number;
  count: number;
}

export interface FuelReportRow {
  fuelType: FuelType;
  label: string;
  salesCount: number;
  purchasesCount: number;
  purchasedBarrels: number;
  purchasedLiters: number;
  purchasedTons: number;
  purchasedAmountToman: number;
  avgBuyPerBarrelToman: number;
  soldBarrels: number;
  soldLiters: number;
  soldTons: number;
  soldAmountToman: number;
  avgSellPerBarrelToman: number;
  grossProfitToman: number;
  profitSharePercent: number;
}

export interface DailyReportRow {
  dateKey: string;
  jalaliLabel: string;
  salesCount: number;
  purchasesCount: number;
  soldBarrels: number;
  purchasedBarrels: number;
  salesToman: number;
  purchasesToman: number;
  grossProfitToman: number;
  expensesToman: number;
  netProfitToman: number;
}

export interface PartyReportRow {
  partyKey: string;
  partyName: string;
  partyPhone: string;
  tradeCount: number;
  barrels: number;
  liters: number;
  totalToman: number;
  grossProfitToman: number;
  netBalanceToman: number;
}

export interface CityReportRow {
  city: string;
  salesCount: number;
  soldBarrels: number;
  soldLiters: number;
  totalSalesToman: number;
  grossProfitToman: number;
}

export interface InventoryValuationRow {
  productId: number;
  name: string;
  fuelType: FuelType;
  stockBarrels: number;
  reservedBarrels: number;
  availableBarrels: number;
  totalLiters: number;
  costValuationToman: number;
  retailValuationToman: number;
  potentialProfitToman: number;
}

export interface ComprehensiveReport {
  dateFrom: string;
  dateTo: string;
  pnl: {
    salesCount: number;
    purchasesCount: number;
    totalSalesToman: number;
    totalPurchasesToman: number;
    totalCostOfGoodsToman: number;
    totalFreightChargedToman: number;
    totalDiscountToman: number;
    grossProfitToman: number;
    grossMarginPercent: number;
    totalExpensesToman: number;
    expensesByCategory: ExpenseCategoryBreakdown[];
    netProfitToman: number;
    netMarginPercent: number;
  };
  byFuel: FuelReportRow[];
  daily: DailyReportRow[];
  topBuyers: PartyReportRow[];
  topSellers: PartyReportRow[];
  byCity: CityReportRow[];
  inventoryValuation: InventoryValuationRow[];
  totalInventoryCostToman: number;
  totalInventoryRetailToman: number;
}
