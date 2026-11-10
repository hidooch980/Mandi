"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calculator,
  CheckCircle2,
  Fuel,
  Printer,
  ShoppingBag,
} from "lucide-react";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/StatusBadge";
import { formatJalaliDateTime, formatNumberFa, formatUsd } from "@/lib/jalali";
import { calculateOrderEconomics, FUEL_LABELS } from "@/lib/pricing-engine";
import type { MarketConfig, Order, Product, PublicUser } from "@/lib/types";

const CITY_FREIGHT_ESTIMATE: Record<string, number> = {
  تهران: 1500000,
  کرج: 1800000,
  اصفهان: 4200000,
  بندرعباس: 2500000,
  شیراز: 5500000,
  مشهد: 6200000,
  تبریز: 5800000,
};

export function CustomerPortalClient({
  user,
  products,
  initialOrders,
  config,
}: {
  user: PublicUser;
  products: Product[];
  initialOrders: Order[];
  config: MarketConfig;
}) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [selectedId, setSelectedId] = useState<number>(products[0]?.id ?? 0);
  const [qty, setQty] = useState<number>(20);
  const [city, setCity] = useState<string>(user.city || "تهران");
  const [address, setAddress] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState("حواله بانکی ساتنا");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  const selectedProduct = products.find((p) => p.id === selectedId) ?? products[0];
  const estimatedFreight = CITY_FREIGHT_ESTIMATE[city.trim()] ?? 3500000;

  const calc = selectedProduct
    ? calculateOrderEconomics({
        quantityBarrels: qty,
        barrelLiters: selectedProduct.barrelLiters,
        density: selectedProduct.density,
        unitPricePerBarrelToman: selectedProduct.effectivePricePerBarrelToman,
        freightToman: estimatedFreight,
        vatPercent: config.vatPercent,
        usdToToman: config.usdToToman,
      })
    : null;

  async function handleSubmitOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProduct) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tradeType: "SALE",
          productId: selectedProduct.id,
          quantityBarrels: qty,
          destinationCity: city,
          deliveryAddress: address,
          freightToman: estimatedFreight,
          paymentMethod,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFeedback({ type: "err", text: data.error || "خطا در ثبت سفارش" });
      } else {
        setOrders([data.order, ...orders]);
        setAddress("");
        setNotes("");
        setFeedback({
          type: "ok",
          text: `سفارش ${data.order.orderNumber} ثبت شد و پیش‌فاکتور آن در لیست پایین قابل چاپ است.`,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-l from-slate-900 to-emerald-950 text-white p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs text-emerald-300 font-semibold">
            <ShoppingBag className="w-4 h-4" />
            <span>سفارش بشکه‌ای بنزین و گازوئیل</span>
          </div>
          <h1 className="text-lg sm:text-2xl font-extrabold">
            خوش آمدید، {user.name}
          </h1>
          <p className="text-xs text-slate-300">
            ثبت سفارش آنلاین بنزین و گازوئیل بشکه‌ای و دریافت پیش‌فاکتور PDF
          </p>
        </div>
        <div className="rounded-xl bg-white/10 border border-white/15 px-4 py-2.5 text-xs shrink-0">
          <div className="text-slate-300">نرخ دلار مبنا</div>
          <div className="text-base font-extrabold text-amber-300 tabular-nums">
            {formatNumberFa(config.usdToToman)} تومان
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-xl p-3.5 text-xs sm:text-sm font-medium border ${
            feedback.type === "ok"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {feedback.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-3">
          <h2 className="font-bold text-slate-900 text-sm sm:text-base">
            ۱. بنزین یا گازوئیل مورد نظر را انتخاب کنید:
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {products.map((p) => {
              const avail = Math.max(p.stockBarrels - p.reservedBarrels, 0);
              const selected = p.id === selectedProduct?.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(p.id);
                    if (qty < p.minOrderBarrels) setQty(p.minOrderBarrels);
                  }}
                  className={`text-right rounded-2xl p-4 border-2 transition cursor-pointer flex flex-col justify-between gap-3 ${
                    selected
                      ? "bg-emerald-50/60 border-emerald-600 shadow-md"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          p.fuelType === "DIESEL"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {FUEL_LABELS[p.fuelType]}
                      </span>
                      {selected && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                    </div>
                    <div className="font-bold text-sm text-slate-900">{p.name}</div>
                    <p className="text-[11px] text-slate-500 leading-5">
                      {p.description}
                    </p>
                  </div>

                  <div className="border-t border-slate-200/70 pt-2.5 flex items-end justify-between gap-2 tabular-nums">
                    <div>
                      <div className="text-[11px] text-slate-500">قیمت هر بشکه</div>
                      <div className="text-base font-extrabold text-slate-900">
                        {formatNumberFa(p.effectivePricePerBarrelToman)} ت
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {formatNumberFa(p.effectivePricePerLiterToman)} ت/لیتر •{" "}
                        {formatUsd(p.effectivePricePerBarrelUsd)}
                      </div>
                    </div>
                    <div className="text-left text-[11px]">
                      <div className="text-emerald-700 font-bold">
                        موجود: {formatNumberFa(avail)} بشکه
                      </div>
                      <div className="text-slate-400">{p.warehouseCity}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <form
          onSubmit={handleSubmitOrder}
          className="lg:col-span-5 rounded-2xl bg-white border border-slate-200 p-5 space-y-4 shadow-xs h-fit"
        >
          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm sm:text-base border-b border-slate-100 pb-3">
            <Calculator className="w-5 h-5 text-amber-600" />
            <span>۲. محاسبه و ثبت سفارش</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                تعداد بشکه (حداقل {selectedProduct?.minOrderBarrels ?? 1})
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={selectedProduct?.minOrderBarrels ?? 1}
                  dir="ltr"
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                  className="flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-extrabold"
                />
                {[5, 20, 50, 100].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setQty(preset)}
                    className={`px-2.5 py-2 rounded-lg font-bold cursor-pointer ${
                      qty === preset
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {formatNumberFa(preset)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  شهر مقصد *
                </label>
                <input
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  روش پرداخت
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  <option value="حواله بانکی ساتنا">حواله بانکی ساتنا</option>
                  <option value="تسویه نقدی درب انبار">تسویه نقدی درب انبار</option>
                  <option value="چک صیادی معتبر">چک صیادی معتبر</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                آدرس دقیق تحویل
              </label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                توضیحات سفارش
              </label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </div>
          </div>

          {calc && (
            <div className="rounded-xl bg-slate-950 text-white p-4 space-y-2 text-xs tabular-nums">
              <div className="flex justify-between text-slate-300">
                <span>حجم و وزن تقریبی:</span>
                <span className="font-bold text-white">
                  {formatNumberFa(calc.totalLiters)} لیتر ({formatNumberFa(calc.totalTons, 3)} تن)
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>جمع کل کالا:</span>
                <span>{formatNumberFa(calc.subtotalToman)} ت</span>
              </div>
              <div className="flex justify-between text-emerald-400">
                <span>تخفیف پلکانی ({formatNumberFa(calc.discountPercent, 1)}٪):</span>
                <span>-{formatNumberFa(calc.discountToman)} ت</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>برآورد کرایه حمل:</span>
                <span>+{formatNumberFa(calc.freightToman)} ت</span>
              </div>
              <div className="border-t border-slate-800 pt-2 flex justify-between text-sm font-extrabold text-amber-300">
                <span>مبلغ نهایی برآوردی:</span>
                <span>{formatNumberFa(calc.totalToman)} ت</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>معادل ارزی:</span>
                <span>{formatUsd(calc.totalUsd)}</span>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !selectedProduct}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            <Fuel className="w-4 h-4" />
            <span>{busy ? "در حال ثبت..." : "ثبت سفارش و دریافت پیش‌فاکتور"}</span>
          </button>
        </form>
      </div>

      <div
        id="my-orders"
        className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs"
      >
        <div className="p-4 sm:p-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 text-sm sm:text-base">
            سفارش‌های من ({formatNumberFa(orders.length)})
          </h2>
        </div>

        <div className="divide-y divide-slate-100">
          {orders.map((o) => {
            const totalBarrels = o.items.reduce(
              (acc, i) => acc + i.quantityBarrels,
              0
            );
            const totalLiters = o.items.reduce((acc, i) => acc + i.totalLiters, 0);
            return (
              <div
                key={o.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-sm text-slate-900 tabular-nums">
                      {o.orderNumber}
                    </span>
                    <OrderStatusBadge status={o.status} />
                    <PaymentStatusBadge status={o.paymentStatus} />
                  </div>
                  <div className="text-slate-700 font-semibold">
                    {o.items[0]?.productName} —{" "}
                    <span className="tabular-nums">
                      {formatNumberFa(totalBarrels)} بشکه ({formatNumberFa(totalLiters)} لیتر)
                    </span>
                  </div>
                  <div className="text-slate-500">
                    {formatJalaliDateTime(o.createdAt)} • مقصد: {o.destinationCity}
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2">
                  <div className="font-extrabold text-sm text-slate-900 tabular-nums">
                    {formatNumberFa(o.totalToman)} تومان
                  </div>
                  <Link
                    href={`/orders/${o.id}/invoice`}
                    className="px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold inline-flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    پیش‌فاکتور PDF
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
