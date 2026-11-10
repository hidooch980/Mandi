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
}

export interface SellerSummary extends PriceSource {
  purchaseCount: number;
  totalPurchasedToman: number;
  totalBarrelsPurchased: number;
  latestQuoteRawPrice: number | null;
  latestQuoteCurrency: PriceCurrency | null;
  latestQuoteUnit: PriceUnit | null;
}
