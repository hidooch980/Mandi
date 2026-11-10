"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, FileText, Printer, Truck } from "lucide-react";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/StatusBadge";
import { formatJalaliDateTime, formatNumberFa, formatUsd } from "@/lib/jalali";
import { calculateOrderEconomics, FUEL_LABELS } from "@/lib/pricing-engine";
import type {
  MarketConfig,
  Order,
  OrderStatus,
  PaymentStatus,
  PriceSource,
  Product,
  PublicUser,
  TradeType,
} from "@/lib/types";

export function OrdersClient({
  initialOrders,
  products,
  customers,
  sellers,
  config,
}: {
  initialOrders: Order[];
  products: Product[];
  customers: PublicUser[];
  sellers: PriceSource[];
  config: MarketConfig;
}) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [filterMode, setFilterMode] = useState<string>("ALL");
  const [modalTradeType, setModalTradeType] = useState<TradeType | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  // New Trade Form
  const activeProducts = products.filter((p) => p.isActive);
  const [selectedProductId, setSelectedProductId] = useState<number>(
    activeProducts[0]?.id ?? 1
  );
  const [quantityBarrels, setQuantityBarrels] = useState<number>(1);
  const [customUnitPrice, setCustomUnitPrice] = useState<string>("");
  const [receiveImmediately, setReceiveImmediately] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    customers[0] ? String(customers[0].id) : ""
  );
  const [selectedSellerId, setSelectedSellerId] = useState<string>(
    sellers[0] ? String(sellers[0].id) : ""
  );
  const [counterpartyName, setCounterpartyName] = useState(
    customers[0]?.name ?? ""
  );
  const [counterpartyPhone, setCounterpartyPhone] = useState(
    customers[0]?.phone ?? ""
  );
  const [counterpartyCompany, setCounterpartyCompany] = useState(
    customers[0]?.companyName ?? ""
  );
  const [destinationCity, setDestinationCity] = useState(
    customers[0]?.city ?? "تهران"
  );
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [freightToman, setFreightToman] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState("حواله بانکی ساتنا");
  const [notes, setNotes] = useState("");

  // Edit Trade Form
  const [editStatus, setEditStatus] = useState<OrderStatus>("PROFORMA");
  const [editPayment, setEditPayment] = useState<PaymentStatus>("UNPAID");
  const [editPlate, setEditPlate] = useState("");
  const [editWaybill, setEditWaybill] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const selectedProduct =
    activeProducts.find((p) => p.id === selectedProductId) ?? activeProducts[0];
  const isPurchaseModal = modalTradeType === "PURCHASE";

  const effectiveUnitPrice =
    customUnitPrice && Number(customUnitPrice) > 0
      ? Number(customUnitPrice)
      : selectedProduct?.effectivePricePerBarrelToman ?? 0;

  const preview = selectedProduct
    ? calculateOrderEconomics({
        quantityBarrels,
        barrelLiters: selectedProduct.barrelLiters,
        density: selectedProduct.density,
        unitPricePerBarrelToman: effectiveUnitPrice,
        freightToman,
        vatPercent: config.vatPercent,
        usdToToman: config.usdToToman,
        isPurchase: isPurchaseModal,
      })
    : null;

  const filtered = orders.filter((o) => {
    if (filterMode === "SALE") return o.tradeType === "SALE";
    if (filterMode === "PURCHASE") return o.tradeType === "PURCHASE";
    if (filterMode === "DIESEL") return o.items[0]?.fuelType === "DIESEL";
    if (filterMode === "GASOLINE") return o.items[0]?.fuelType === "GASOLINE";
    return true;
  });

  function openNewTrade(type: TradeType) {
    setErrMsg("");
    setModalTradeType(type);
    if (type === "PURCHASE") {
      setSelectedCustomerId("");
      const firstSeller = sellers[0];
      setSelectedSellerId(firstSeller ? String(firstSeller.id) : "");
      setCounterpartyName(firstSeller?.name ?? "");
      setCounterpartyPhone(firstSeller?.contactInfo ?? "");
      setCounterpartyCompany(firstSeller?.city ?? "");
      setDestinationCity(firstSeller?.city ?? "انبار اصلی");
      setCustomUnitPrice(
        selectedProduct
          ? String(
              selectedProduct.lastCostPerBarrelToman ||
                Math.round(selectedProduct.effectivePricePerBarrelToman * 0.94)
            )
          : ""
      );
    } else {
      const firstCust = customers[0];
      setSelectedCustomerId(firstCust ? String(firstCust.id) : "");
      setCounterpartyName(firstCust?.name ?? "");
      setCounterpartyPhone(firstCust?.phone ?? "");
      setCounterpartyCompany(firstCust?.companyName ?? "");
      setCustomUnitPrice("");
    }
  }

  function handleSelectSeller(sid: string) {
    setSelectedSellerId(sid);
    const found = sellers.find((s) => String(s.id) === sid);
    if (found) {
      setCounterpartyName(found.name);
      setCounterpartyPhone(found.contactInfo);
      setCounterpartyCompany(found.city);
      setDestinationCity(found.city);
    }
  }

  function handleSelectCustomer(cid: string) {
    setSelectedCustomerId(cid);
    const found = customers.find((c) => String(c.id) === cid);
    if (found) {
      setCounterpartyName(found.name);
      setCounterpartyPhone(found.phone);
      setCounterpartyCompany(found.companyName);
      setDestinationCity(found.city);
    }
  }

  async function handleCreateTrade(e: React.FormEvent) {
    e.preventDefault();
    if (!modalTradeType) return;
    setBusy(true);
    setErrMsg("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tradeType: modalTradeType,
          productId: selectedProductId,
          quantityBarrels,
          customUnitPriceBarrelToman:
            customUnitPrice && Number(customUnitPrice) > 0
              ? Number(customUnitPrice)
              : undefined,
          receiveImmediately: isPurchaseModal ? receiveImmediately : undefined,
          customerId:
            !isPurchaseModal && selectedCustomerId
              ? Number(selectedCustomerId)
              : undefined,
          customerName: counterpartyName,
          customerPhone: counterpartyPhone,
          customerCompany: counterpartyCompany,
          destinationCity,
          deliveryAddress,
          freightToman,
          paymentMethod,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrMsg(data.error || "خطا در ثبت معامله");
      } else {
        setOrders([data.order, ...orders]);
        setModalTradeType(null);
        setNotes("");
      }
    } finally {
      setBusy(false);
    }
  }

  function openEditModal(order: Order) {
    setEditingOrder(order);
    setEditStatus(order.status);
    setEditPayment(order.paymentStatus);
    setEditPlate(order.driverPlate);
    setEditWaybill(order.waybillNumber);
    setEditNotes(order.notes);
  }

  async function handleUpdateOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!editingOrder) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${editingOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editStatus,
          paymentStatus: editPayment,
          driverPlate: editPlate,
          waybillNumber: editWaybill,
          notes: editNotes,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setOrders(orders.map((o) => (o.id === editingOrder.id ? data.order : o)));
        setEditingOrder(null);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-sky-600" />
            <span>دفتر خرید و فروش بنزین و گازوئیل</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            ثبت خریدهای ورودی به انبار و فروش‌های بشکه‌ای بنزین و گازوئیل + صدور فاکتور PDF
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openNewTrade("PURCHASE")}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowDownLeft className="w-4 h-4" />
            ثبت خرید (ورود به انبار)
          </button>
          <button
            type="button"
            onClick={() => openNewTrade("SALE")}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4" />
            ثبت فروش (صدور فاکتور)
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "ALL", label: "همه معاملات" },
          { key: "SALE", label: "فقط فروش‌ها" },
          { key: "PURCHASE", label: "فقط خریدها (تامین)" },
          { key: "DIESEL", label: "گازوئیل" },
          { key: "GASOLINE", label: "بنزین" },
        ].map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilterMode(f.key)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
              filterMode === f.key
                ? "bg-slate-900 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">نوع معامله و شماره</th>
                <th className="py-3 px-3">طرف حساب / مقصد</th>
                <th className="py-3 px-3">فرآورده و بشکه</th>
                <th className="py-3 px-3">مبلغ کل</th>
                <th className="py-3 px-3">وضعیت / تسویه</th>
                <th className="py-3 px-3">پلاک و بارنامه</th>
                <th className="py-3 px-3">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((o) => {
                const totalBarrels = o.items.reduce(
                  (acc, i) => acc + i.quantityBarrels,
                  0
                );
                const totalLiters = o.items.reduce(
                  (acc, i) => acc + i.totalLiters,
                  0
                );
                const fuel = o.items[0]?.fuelType ?? "DIESEL";
                return (
                  <tr key={o.id} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            o.tradeType === "PURCHASE"
                              ? "bg-indigo-100 text-indigo-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {o.tradeType === "PURCHASE" ? "خرید" : "فروش"}
                        </span>
                        <span className="font-extrabold text-slate-900 tabular-nums">
                          {o.orderNumber}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {formatJalaliDateTime(o.createdAt)}
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-slate-900">{o.customerName}</div>
                      <div className="text-[11px] text-slate-500">
                        {o.customerCompany ? `${o.customerCompany} • ` : ""}
                        {o.destinationCity}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 tabular-nums">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            fuel === "DIESEL"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {FUEL_LABELS[fuel]}
                        </span>
                        <span className="font-bold text-slate-800">
                          {formatNumberFa(totalBarrels)} بشکه ({formatNumberFa(totalLiters)} لیتر)
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-48 mt-0.5">
                        {o.items[0]?.productName}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 tabular-nums">
                      <div className="font-extrabold text-slate-900">
                        {formatNumberFa(o.totalToman)} ت
                      </div>
                      {o.tradeType === "SALE" ? (
                        <div className="text-[11px] text-emerald-700 font-semibold">
                          سود: {formatNumberFa(o.estimatedProfitToman)} ت
                        </div>
                      ) : (
                        <div className="text-[11px] text-indigo-700 font-semibold">
                          ورود به موجودی
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-3 space-y-1">
                      <div>
                        <OrderStatusBadge status={o.status} />
                      </div>
                      <div>
                        <PaymentStatusBadge status={o.paymentStatus} />
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-[11px] text-slate-600">
                      {o.waybillNumber || o.driverPlate ? (
                        <div>
                          <div>پلاک: {o.driverPlate || "—"}</div>
                          <div>بارنامه: {o.waybillNumber || "—"}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400">در انتظار ثبت</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/orders/${o.id}/invoice`}
                          className="px-2.5 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold inline-flex items-center gap-1"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          سند PDF
                        </Link>
                        <button
                          type="button"
                          onClick={() => openEditModal(o)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          وضعیت
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    معامله‌ای با این فیلتر یافت نشد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Trade Modal (Purchase or Sale) */}
      {modalTradeType && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateTrade}
            className="w-full max-w-xl rounded-2xl bg-white p-5 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto"
          >
            <h3 className="font-bold text-base text-slate-900">
              {isPurchaseModal
                ? "ثبت خرید بنزین / گازوئیل و ورود بشکه به انبار"
                : "ثبت فروش بنزین / گازوئیل و صدور پیش‌فاکتور"}
            </h3>
            {errMsg && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3">
                {errMsg}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  نوع سوخت و بشکه
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  {activeProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{FUEL_LABELS[p.fuelType]}] {p.name} — موجودی:{" "}
                      {p.stockBarrels - p.reservedBarrels} بشکه
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  تعداد بشکه *
                </label>
                <input
                  required
                  type="number"
                  min={1}
                  dir="ltr"
                  value={quantityBarrels}
                  onChange={(e) => setQuantityBarrels(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {isPurchaseModal
                    ? "قیمت خرید هر بشکه (تومان)"
                    : "قیمت توافقی هر بشکه (خالی = نرخ مصوب)"}
                </label>
                <input
                  type="number"
                  dir="ltr"
                  value={customUnitPrice}
                  onChange={(e) => setCustomUnitPrice(e.target.value)}
                  placeholder={String(selectedProduct?.effectivePricePerBarrelToman ?? 0)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  کرایه حمل (تومان)
                </label>
                <input
                  type="number"
                  dir="ltr"
                  value={freightToman}
                  onChange={(e) => setFreightToman(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              {isPurchaseModal ? (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      انتخاب فروشنده از لیست فروشندگان
                    </label>
                    <select
                      value={selectedSellerId}
                      onChange={(e) => handleSelectSeller(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    >
                      <option value="">-- ورود دستی فروشنده --</option>
                      {sellers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.contactInfo || s.city})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-2">
                    <input
                      id="recvNow"
                      type="checkbox"
                      checked={receiveImmediately}
                      onChange={(e) => setReceiveImmediately(e.target.checked)}
                      className="w-4 h-4 accent-indigo-600"
                    />
                    <label htmlFor="recvNow" className="font-semibold text-slate-700">
                      بلافاصله به موجودی انبار اضافه شود
                    </label>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    انتخاب خریدار ثبت‌شده
                  </label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => handleSelectCustomer(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    <option value="">-- ورود دستی خریدار --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.companyName || c.city})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {isPurchaseModal ? "نام فروشنده / تامین‌کننده *" : "نام خریدار *"}
                </label>
                <input
                  required
                  value={counterpartyName}
                  onChange={(e) => setCounterpartyName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  تلفن تماس *
                </label>
                <input
                  required
                  dir="ltr"
                  value={counterpartyPhone}
                  onChange={(e) => setCounterpartyPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  نام شرکت / انبار
                </label>
                <input
                  value={counterpartyCompany}
                  onChange={(e) => setCounterpartyCompany(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  شهر {isPurchaseModal ? "مبدا / انبار" : "مقصد"} *
                </label>
                <input
                  required
                  value={destinationCity}
                  onChange={(e) => setDestinationCity(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  آدرس / محل تحویل
                </label>
                <input
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  روش تسویه
                </label>
                <input
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  توضیحات
                </label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
            </div>

            {preview && (
              <div className="rounded-xl bg-slate-900 text-white p-3.5 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2 tabular-nums">
                <div>
                  <div className="text-slate-400">حجم / وزن</div>
                  <div className="font-bold">
                    {formatNumberFa(preview.totalLiters)} لیتر ({preview.totalTons} تن)
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">تخفیف حجمی</div>
                  <div className="font-bold text-emerald-400">
                    {formatNumberFa(preview.discountPercent, 1)}٪ ({formatNumberFa(preview.discountToman)} ت)
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">جمع نهایی سند</div>
                  <div className="font-extrabold text-amber-300">
                    {formatNumberFa(preview.totalToman)} ت
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">معادل دلاری</div>
                  <div className="font-bold">{formatUsd(preview.totalUsd)}</div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalTradeType(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={busy}
                className={`px-5 py-2 rounded-xl text-white text-xs font-bold cursor-pointer ${
                  isPurchaseModal ? "bg-indigo-600" : "bg-emerald-600"
                }`}
              >
                {isPurchaseModal ? "ثبت خرید" : "ثبت فروش و پیش‌فاکتور"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Update Order Modal */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleUpdateOrder}
            className="w-full max-w-md rounded-2xl bg-white p-5 space-y-4 shadow-2xl"
          >
            <h3 className="font-bold text-base text-slate-900">
              بروزرسانی وضعیت و بارنامه — {editingOrder.orderNumber}
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  وضعیت معامله
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as OrderStatus)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  <option value="PENDING">در انتظار تایید</option>
                  <option value="PROFORMA">پیش‌فاکتور صادر شده</option>
                  <option value="PAID">تسویه مالی</option>
                  <option value="DISPATCHED">بارگیری و ارسال‌شده</option>
                  <option value="DELIVERED">
                    {editingOrder.tradeType === "PURCHASE"
                      ? "تحویل‌شده به انبار (افزایش موجودی)"
                      : "تحویل‌شده به خریدار"}
                  </option>
                  <option value="CANCELLED">لغوشده</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  وضعیت پرداخت
                </label>
                <select
                  value={editPayment}
                  onChange={(e) => setEditPayment(e.target.value as PaymentStatus)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  <option value="UNPAID">تسویه‌نشده</option>
                  <option value="PARTIAL">پیش‌پرداخت</option>
                  <option value="PAID">پرداخت کامل</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  پلاک خودرو / ناوگان
                </label>
                <input
                  value={editPlate}
                  onChange={(e) => setEditPlate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  شماره بارنامه / رسید انبار
                </label>
                <input
                  dir="ltr"
                  value={editWaybill}
                  onChange={(e) => setEditWaybill(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  یادداشت
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
              >
                ذخیره تغییرات
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
