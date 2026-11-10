"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Boxes,
  Compass,
  FileText,
  Fuel,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { PriceHistoryChart } from "@/components/Charts";
import { OrderStatusBadge } from "@/components/StatusBadge";
import { formatJalaliDate, formatNumberFa, formatUsd } from "@/lib/jalali";
import { FUEL_LABELS } from "@/lib/pricing-engine";
import type {
  DieselDiscoverySummary,
  MarketConfig,
  Order,
  PriceHistoryPoint,
  Product,
} from "@/lib/types";

interface DashboardClientProps {
  config: MarketConfig;
  dieselSummary: DieselDiscoverySummary;
  history: PriceHistoryPoint[];
  products: Product[];
  orders: Order[];
}

export function DashboardClient({
  config,
  dieselSummary,
  history,
  products,
  orders,
}: DashboardClientProps) {
  const dieselBarrels = products
    .filter((p) => p.fuelType === "DIESEL")
    .reduce((acc, p) => acc + Math.max(p.stockBarrels - p.reservedBarrels, 0), 0);

  const gasolineBarrels = products
    .filter((p) => p.fuelType === "GASOLINE")
    .reduce((acc, p) => acc + Math.max(p.stockBarrels - p.reservedBarrels, 0), 0);

  const totalSalesToman = orders
    .filter((o) => o.tradeType === "SALE" && o.status !== "CANCELLED")
    .reduce((acc, o) => acc + o.totalToman, 0);

  const totalPurchasesToman = orders
    .filter((o) => o.tradeType === "PURCHASE" && o.status !== "CANCELLED")
    .reduce((acc, o) => acc + o.totalToman, 0);

  const totalProfit = orders
    .filter((o) => o.tradeType === "SALE" && o.status !== "CANCELLED")
    .reduce((acc, o) => acc + o.estimatedProfitToman, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
            داشبورد خرید و فروش بنزین و گازوئیل
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            کشف قیمت چندنفره گازوئیل، وضعیت موجودی بشکه‌ای بنزین و گازوئیل و گزارش خرید و فروش
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/discovery"
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 shadow-sm"
          >
            <Compass className="w-4 h-4" />
            <span>کشف قیمت گازوئیل</span>
          </Link>
          <Link
            href="/orders"
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            <span>ثبت خرید / فروش</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white p-5 border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>بهترین استعلام گازوئیل (از {formatNumberFa(dieselSummary.quoteCount)} نفر)</span>
            <Compass className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 tabular-nums">
            {dieselSummary.bestBuy
              ? `${formatNumberFa(dieselSummary.bestBuy.landedPerBarrelToman)} ت`
              : "—"}
          </div>
          <div className="text-xs text-emerald-700 font-medium truncate">
            {dieselSummary.bestBuy?.sourceName ?? "بدون استعلام فعال"}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>نرخ فروش روز بشکه (۲۲۰ لیتری)</span>
            <TrendingUp className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-sm font-extrabold text-slate-900 tabular-nums space-y-1">
            <div className="flex justify-between">
              <span className="text-emerald-700">گازوئیل:</span>
              <span>{formatNumberFa(dieselSummary.publishedSellPerBarrelToman)} ت</span>
            </div>
            <div className="flex justify-between">
              <span className="text-amber-700">بنزین:</span>
              <span>{formatNumberFa(config.publishedGasolineBarrelToman)} ت</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>موجودی قابل فروش انبارها</span>
            <Boxes className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 tabular-nums">
            {formatNumberFa(dieselBarrels + gasolineBarrels)} بشکه
          </div>
          <div className="text-xs text-slate-600 tabular-nums">
            گازوئیل: {formatNumberFa(dieselBarrels)} • بنزین: {formatNumberFa(gasolineBarrels)}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>گردش خرید و فروش و سود</span>
            <Wallet className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl font-extrabold text-emerald-700 tabular-nums">
            +{formatNumberFa(totalProfit)} ت سود
          </div>
          <div className="text-[11px] text-slate-500 tabular-nums">
            فروش: {formatNumberFa(totalSalesToman)} | خرید: {formatNumberFa(totalPurchasesToman)}
          </div>
        </div>
      </div>

      {/* Diesel & Gasoline Quick Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm sm:text-base text-slate-900 flex items-center gap-2">
              <Fuel className="w-4 h-4 text-emerald-600" />
              وضعیت کشف قیمت گازوئیل (چندنفره)
            </h2>
            <Link
              href="/discovery"
              className="text-xs text-emerald-700 font-bold inline-flex items-center gap-1 hover:underline"
            >
              مدیریت استعلام‌ها
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs tabular-nums">
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-slate-500">میانگین وزنی</div>
              <div className="font-bold text-slate-900 mt-1">
                {formatNumberFa(dieselSummary.weightedAvgPerBarrelToman)} ت
              </div>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3">
              <div className="text-emerald-700">پیشنهاد فروش</div>
              <div className="font-bold text-emerald-900 mt-1">
                {formatNumberFa(dieselSummary.suggestedSellPerBarrelToman)} ت
              </div>
            </div>
            <div className="rounded-xl bg-amber-50 p-3">
              <div className="text-amber-700">سود هر بشکه</div>
              <div className="font-bold text-amber-900 mt-1">
                {formatNumberFa(dieselSummary.estimatedProfitPerBarrelToman)} ت
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm sm:text-base text-slate-900 flex items-center gap-2">
              <Fuel className="w-4 h-4 text-amber-600" />
              نرخ و موجودی بنزین بشکه‌ای
            </h2>
            <Link
              href="/inventory"
              className="text-xs text-amber-700 font-bold inline-flex items-center gap-1 hover:underline"
            >
              تغییر نرخ / انبار
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs tabular-nums">
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-slate-500">نرخ فروش بشکه</div>
              <div className="font-bold text-slate-900 mt-1">
                {formatNumberFa(config.publishedGasolineBarrelToman)} ت
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-slate-500">معادل دلاری</div>
              <div className="font-bold text-slate-900 mt-1">
                {formatUsd(
                  config.publishedGasolineBarrelToman / Math.max(config.usdToToman, 1)
                )}
              </div>
            </div>
            <div className="rounded-xl bg-amber-50 p-3">
              <div className="text-amber-700">موجودی بنزین</div>
              <div className="font-bold text-amber-900 mt-1">
                {formatNumberFa(gasolineBarrels)} بشکه
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Diesel Price History Chart + Recent Trades */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-2xl bg-white border border-slate-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-sm sm:text-base">
              روند ۱۰ روزه کشف قیمت گازوئیل (بشکه ۲۲۰ لیتری)
            </h2>
            <Link
              href="/discovery"
              className="text-xs text-emerald-700 font-bold hover:underline"
            >
              جزئیات استعلام‌ها
            </Link>
          </div>
          <PriceHistoryChart points={history} />
        </div>

        <div className="lg:col-span-5 rounded-2xl bg-white border border-slate-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-sm sm:text-base">
              آخرین معاملات خرید و فروش
            </h2>
            <Link
              href="/orders"
              className="text-xs text-emerald-700 font-bold hover:underline"
            >
              مشاهده همه
            </Link>
          </div>

          <div className="space-y-2.5">
            {orders.slice(0, 6).map((order) => (
              <div
                key={order.id}
                className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        order.tradeType === "PURCHASE"
                          ? "bg-indigo-100 text-indigo-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {order.tradeType === "PURCHASE" ? "خرید" : "فروش"}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-800 text-[10px] font-bold">
                      {order.items[0] ? FUEL_LABELS[order.items[0].fuelType] : "سوخت"}
                    </span>
                    <span className="font-bold text-xs text-slate-900 tabular-nums">
                      {order.orderNumber}
                    </span>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <div className="text-xs text-slate-600 truncate mt-1">
                    {order.customerName} • {order.destinationCity}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
                    {formatJalaliDate(order.createdAt)}
                  </div>
                </div>

                <div className="text-left shrink-0 space-y-1">
                  <div className="text-xs font-extrabold text-slate-900 tabular-nums">
                    {formatNumberFa(order.totalToman)} ت
                  </div>
                  <Link
                    href={`/orders/${order.id}/invoice`}
                    className="inline-block text-[11px] text-sky-700 hover:underline font-semibold"
                  >
                    سند PDF
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
