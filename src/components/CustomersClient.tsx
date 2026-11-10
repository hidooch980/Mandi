"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Store, UserCheck, Users, Wallet } from "lucide-react";
import { formatJalaliDate, formatNumberFa } from "@/lib/jalali";
import { SOURCE_TYPE_LABELS } from "@/lib/pricing-engine";
import type { BuyerSummary, PriceSourceType, SellerSummary } from "@/lib/types";

export function CustomersClient({
  initialBuyers,
  initialSellers,
}: {
  initialBuyers: BuyerSummary[];
  initialSellers: SellerSummary[];
}) {
  const [tab, setTab] = useState<"BUYERS" | "SELLERS">("BUYERS");
  const [buyers, setBuyers] = useState<BuyerSummary[]>(initialBuyers);
  const [sellers, setSellers] = useState<SellerSummary[]>(initialSellers);
  const [search, setSearch] = useState("");
  const [showBuyerModal, setShowBuyerModal] = useState(false);
  const [showSellerModal, setShowSellerModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Add Buyer form
  const [bName, setBName] = useState("");
  const [bPhone, setBPhone] = useState("");
  const [bCompany, setBCompany] = useState("");
  const [bCity, setBCity] = useState("تهران");
  const [bEmail, setBEmail] = useState("");

  // Add Seller form
  const [sName, setSName] = useState("");
  const [sPhone, setSPhone] = useState("");
  const [sType, setSType] = useState<PriceSourceType>("BROKER_PHONE");
  const [sCity, setSCity] = useState("انبار شرق");
  const [sSmsTarget, setSSmsTarget] = useState(true);

  const q = search.trim().toLowerCase();
  const filteredBuyers = buyers.filter(
    (b) =>
      !q ||
      b.name.toLowerCase().includes(q) ||
      b.phone.includes(q) ||
      b.companyName.toLowerCase().includes(q) ||
      b.city.toLowerCase().includes(q)
  );
  const filteredSellers = sellers.filter(
    (s) =>
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.contactInfo.includes(q) ||
      s.city.toLowerCase().includes(q)
  );

  const totalSalesSum = buyers.reduce((acc, b) => acc + b.totalSpentToman, 0);
  const totalPurchasesSum = sellers.reduce(
    (acc, s) => acc + s.totalPurchasedToman,
    0
  );

  async function refreshAll() {
    const res = await fetch("/api/customers");
    const data = await res.json();
    if (data.ok) {
      setBuyers(data.buyers);
      setSellers(data.sellers);
    }
  }

  async function handleAddBuyer(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: bName,
          phone: bPhone,
          companyName: bCompany,
          city: bCity,
          email: bEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErr(data.error || "خطا در افزودن خریدار");
      } else {
        setBuyers(data.buyers);
        setShowBuyerModal(false);
        setBName("");
        setBPhone("");
        setBCompany("");
        setBEmail("");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleAddSeller(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: sName,
          contactInfo: sPhone,
          type: sType,
          city: sCity,
          isSmsTarget: sSmsTarget,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErr(data.error || "خطا در افزودن فروشنده");
      } else {
        await refreshAll();
        setShowSellerModal(false);
        setSName("");
        setSPhone("");
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggleSellerFlag(
    seller: SellerSummary,
    patch: { isActive?: boolean; isSmsTarget?: boolean }
  ) {
    setBusy(true);
    try {
      await fetch(`/api/sources/${seller.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      await refreshAll();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            <span>لیست فروشندگان و لیست خریداران</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            مدیریت یکپارچه خریداران (فروش ما) و فروشندگان/دلال‌ها (خرید و استعلام ساعتی ما)
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/ledger"
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5"
          >
            <Wallet className="w-4 h-4" />
            بدهکار و بستانکار
          </Link>
          <button
            type="button"
            onClick={() => {
              setErr("");
              setShowSellerModal(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            افزودن فروشنده
          </button>
          <button
            type="button"
            onClick={() => {
              setErr("");
              setShowBuyerModal(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            افزودن خریدار
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-1">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <span>تعداد خریداران</span>
          </div>
          <div className="text-xl font-extrabold text-slate-900 tabular-nums">
            {formatNumberFa(buyers.length)} نفر
          </div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-1">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Store className="w-4 h-4 text-indigo-600" />
            <span>تعداد فروشندگان / دلال‌ها</span>
          </div>
          <div className="text-xl font-extrabold text-slate-900 tabular-nums">
            {formatNumberFa(sellers.length)} مورد
          </div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-1">
          <div className="text-xs text-slate-500">مجموع فروش به خریداران</div>
          <div className="text-lg font-extrabold text-emerald-700 tabular-nums">
            {formatNumberFa(totalSalesSum)} ت
          </div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-1">
          <div className="text-xs text-slate-500">مجموع خرید از فروشندگان</div>
          <div className="text-lg font-extrabold text-indigo-700 tabular-nums">
            {formatNumberFa(totalPurchasesSum)} ت
          </div>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-white border border-slate-200 p-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => setTab("BUYERS")}
            className={`px-4 py-2 rounded-lg cursor-pointer transition ${
              tab === "BUYERS"
                ? "bg-emerald-600 text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            لیست خریداران ({formatNumberFa(buyers.length)})
          </button>
          <button
            type="button"
            onClick={() => setTab("SELLERS")}
            className={`px-4 py-2 rounded-lg cursor-pointer transition ${
              tab === "SELLERS"
                ? "bg-indigo-600 text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            لیست فروشندگان ({formatNumberFa(sellers.length)})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو نام، شماره تماس یا شهر..."
            className="w-full rounded-xl border border-slate-300 bg-white pr-9 pl-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
      </div>

      {/* Buyers Table */}
      {tab === "BUYERS" && (
        <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">نام خریدار و مجموعه</th>
                  <th className="py-3 px-3">شماره تماس / شهر</th>
                  <th className="py-3 px-3">تعداد خرید از ما</th>
                  <th className="py-3 px-3">مجموع بشکه / گالن</th>
                  <th className="py-3 px-3">جمع مبلغ خریداری‌شده</th>
                  <th className="py-3 px-3">مانده بدهکار/بستانکار</th>
                  <th className="py-3 px-3">تاریخ ثبت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBuyers.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{b.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {b.companyName || "خریدار حقیقی"}
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="font-semibold tabular-nums" dir="ltr">
                        {b.phone}
                      </div>
                      <div className="text-[11px] text-slate-500">{b.city}</div>
                    </td>
                    <td className="py-3.5 px-3 font-bold tabular-nums">
                      {formatNumberFa(b.orderCount)}
                    </td>
                    <td className="py-3.5 px-3 font-bold text-emerald-700 tabular-nums">
                      {formatNumberFa(b.totalBarrels)} واحد
                    </td>
                    <td className="py-3.5 px-3 font-extrabold text-slate-900 tabular-nums">
                      {formatNumberFa(b.totalSpentToman)} ت
                    </td>
                    <td className="py-3.5 px-3 tabular-nums">
                      {b.balanceToman > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                          بدهکار: {formatNumberFa(b.balanceToman)} ت
                        </span>
                      ) : b.balanceToman < 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[11px] font-bold">
                          بستانکار: {formatNumberFa(Math.abs(b.balanceToman))} ت
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">تسویه</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-slate-500 tabular-nums">
                      {formatJalaliDate(b.createdAt)}
                    </td>
                  </tr>
                ))}
                {filteredBuyers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      خریداری با این مشخصات پیدا نشد.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sellers Table */}
      {tab === "SELLERS" && (
        <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">نام فروشنده / دلال / کانال</th>
                  <th className="py-3 px-3">تلفن / محل</th>
                  <th className="py-3 px-3">آخرین نرخ استعلام</th>
                  <th className="py-3 px-3">تعداد خرید ما</th>
                  <th className="py-3 px-3">حجم خرید و مبلغ</th>
                  <th className="py-3 px-3">مانده بدهکار/بستانکار</th>
                  <th className="py-3 px-3">پیامک ساعتی / وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSellers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{s.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {SOURCE_TYPE_LABELS[s.type] ?? s.type}
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="font-semibold tabular-nums" dir="ltr">
                        {s.contactInfo || "—"}
                      </div>
                      <div className="text-[11px] text-slate-500">{s.city}</div>
                    </td>
                    <td className="py-3.5 px-3 tabular-nums">
                      {s.latestQuoteRawPrice ? (
                        <div>
                          <span className="font-bold text-slate-900">
                            {formatNumberFa(s.latestQuoteRawPrice)}{" "}
                            {s.latestQuoteCurrency}
                          </span>
                          <div className="text-[11px] text-slate-500">
                            بر مبنای {s.latestQuoteUnit}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">بدون استعلام</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 font-bold tabular-nums">
                      {formatNumberFa(s.purchaseCount)}
                    </td>
                    <td className="py-3.5 px-3 tabular-nums">
                      <div className="font-extrabold text-indigo-700">
                        {formatNumberFa(s.totalPurchasedToman)} ت
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {formatNumberFa(s.totalBarrelsPurchased)} بشکه/واحد
                      </div>
                    </td>
                    <td className="py-3.5 px-3 tabular-nums">
                      {s.balanceToman < 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[11px] font-bold">
                          بستانکار: {formatNumberFa(Math.abs(s.balanceToman))} ت
                        </span>
                      ) : s.balanceToman > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                          بدهکار: {formatNumberFa(s.balanceToman)} ت
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">تسویه</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            toggleSellerFlag(s, { isSmsTarget: !s.isSmsTarget })
                          }
                          className={`px-2 py-1 rounded-lg font-bold text-[11px] cursor-pointer ${
                            s.isSmsTarget
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {s.isSmsTarget ? "پیامک ساعتی: بله" : "پیامک ساعتی: خیر"}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            toggleSellerFlag(s, { isActive: !s.isActive })
                          }
                          className={`px-2 py-1 rounded-lg font-bold text-[11px] cursor-pointer ${
                            s.isActive
                              ? "bg-sky-100 text-sky-800"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {s.isActive ? "فعال" : "غیرفعال"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredSellers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      فروشنده‌ای با این مشخصات پیدا نشد.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Buyer Modal */}
      {showBuyerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleAddBuyer}
            className="w-full max-w-md rounded-2xl bg-white p-5 space-y-4 shadow-2xl"
          >
            <h3 className="font-bold text-base text-slate-900">
              افزودن خریدار جدید به لیست
            </h3>
            {err && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3">
                {err}
              </div>
            )}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  نام کامل خریدار *
                </label>
                <input
                  required
                  value={bName}
                  onChange={(e) => setBName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    موبایل *
                  </label>
                  <input
                    required
                    dir="ltr"
                    value={bPhone}
                    onChange={(e) => setBPhone(e.target.value)}
                    placeholder="0915..."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    شهر
                  </label>
                  <input
                    value={bCity}
                    onChange={(e) => setBCity(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  نام شرکت / ناوگان
                </label>
                <input
                  value={bCompany}
                  onChange={(e) => setBCompany(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ایمیل (اختیاری)
                </label>
                <input
                  type="email"
                  dir="ltr"
                  value={bEmail}
                  onChange={(e) => setBEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBuyerModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer"
              >
                ثبت خریدار
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Seller Modal */}
      {showSellerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleAddSeller}
            className="w-full max-w-md rounded-2xl bg-white p-5 space-y-4 shadow-2xl"
          >
            <h3 className="font-bold text-base text-slate-900">
              افزودن فروشنده / تامین‌کننده جدید
            </h3>
            {err && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3">
                {err}
              </div>
            )}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  نام فروشنده / دلال / شرکت *
                </label>
                <input
                  required
                  value={sName}
                  onChange={(e) => setSName(e.target.value)}
                  placeholder="مثلاً آقای محمدی"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    شماره تماس *
                  </label>
                  <input
                    required
                    dir="ltr"
                    value={sPhone}
                    onChange={(e) => setSPhone(e.target.value)}
                    placeholder="0915..."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    نوع فروشنده
                  </label>
                  <select
                    value={sType}
                    onChange={(e) => setSType(e.target.value as PriceSourceType)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    <option value="BROKER_PHONE">دلال / تماس تلفنی</option>
                    <option value="WHATSAPP">کانال واتساپ</option>
                    <option value="DEPOT">انبار / بنکدار</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  شهر / محل تحویل
                </label>
                <input
                  value={sCity}
                  onChange={(e) => setSCity(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  id="sellerSms"
                  type="checkbox"
                  checked={sSmsTarget}
                  onChange={(e) => setSSmsTarget(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600"
                />
                <label htmlFor="sellerSms" className="font-semibold text-slate-700">
                  در لیست پیامک استعلام ساعتی قرار بگیرد
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSellerModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer"
              >
                ثبت فروشنده
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
