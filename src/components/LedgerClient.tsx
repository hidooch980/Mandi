"use client";

import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Plus,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
import { formatJalaliDateTime, formatNumberFa } from "@/lib/jalali";
import type {
  LedgerEntryType,
  LedgerSummary,
  PartyAccountSummary,
  PartyType,
  PriceSource,
  PublicUser,
} from "@/lib/types";

const ENTRY_TYPE_LABELS: Record<LedgerEntryType, string> = {
  DEBIT_RECEIVABLE: "ثبت بدهکاری (طلب ما)",
  CREDIT_PAYABLE: "ثبت بستانکاری (بدهی ما)",
  RECEIPT_IN: "دریافت وجه از بدهکار",
  PAYMENT_OUT: "پرداخت وجه به بستانکار",
};

const PARTY_TYPE_LABELS: Record<PartyType, string> = {
  BUYER: "خریدار",
  SELLER: "فروشنده / دلال",
  OTHER: "سایر / متفرقه",
};

export function LedgerClient({
  initialSummary,
  buyers,
  sellers,
}: {
  initialSummary: LedgerSummary;
  buyers: PublicUser[];
  sellers: PriceSource[];
}) {
  const [summary, setSummary] = useState<LedgerSummary>(initialSummary);
  const [filterTab, setFilterTab] = useState<
    "ALL" | "DEBTORS" | "CREDITORS" | "SETTLED"
  >("ALL");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  // Form state
  const [entryType, setEntryType] =
    useState<LedgerEntryType>("RECEIPT_IN");
  const [partyType, setPartyType] = useState<PartyType>("BUYER");
  const [partyName, setPartyName] = useState("");
  const [partyPhone, setPartyPhone] = useState("");
  const [amountToman, setAmountToman] = useState("");
  const [note, setNote] = useState("");

  const q = search.trim().toLowerCase();
  const filteredAccounts = summary.accounts.filter((acc) => {
    if (filterTab === "DEBTORS" && acc.netBalanceToman <= 0) return false;
    if (filterTab === "CREDITORS" && acc.netBalanceToman >= 0) return false;
    if (filterTab === "SETTLED" && acc.netBalanceToman !== 0) return false;
    if (!q) return true;
    return (
      acc.partyName.toLowerCase().includes(q) ||
      acc.partyPhone.includes(q)
    );
  });

  function openNewModal(mode: "SETTLE" | "MANUAL") {
    setErr("");
    setOkMsg("");
    setPartyName("");
    setPartyPhone("");
    setAmountToman("");
    setNote("");
    if (mode === "SETTLE") {
      setEntryType("RECEIPT_IN");
      setPartyType("BUYER");
    } else {
      setEntryType("DEBIT_RECEIVABLE");
      setPartyType("OTHER");
    }
    setShowModal(true);
  }

  function openQuickSettle(acc: PartyAccountSummary) {
    setErr("");
    setOkMsg("");
    setPartyName(acc.partyName);
    setPartyPhone(acc.partyPhone);
    setPartyType(acc.partyType);
    setEntryType(acc.netBalanceToman >= 0 ? "RECEIPT_IN" : "PAYMENT_OUT");
    setAmountToman(String(Math.abs(acc.netBalanceToman)));
    setNote(
      acc.netBalanceToman >= 0
        ? `دریافت و تسویه بدهی ${acc.partyName}`
        : `پرداخت و تسویه بستانکاری ${acc.partyName}`
    );
    setShowModal(true);
  }

  function handleSelectPreset(val: string) {
    if (!val) return;
    const [kind, rawId] = val.split(":");
    if (kind === "BUYER") {
      const b = buyers.find((x) => String(x.id) === rawId);
      if (b) {
        setPartyType("BUYER");
        setPartyName(b.name);
        setPartyPhone(b.phone);
      }
    } else if (kind === "SELLER") {
      const s = sellers.find((x) => String(x.id) === rawId);
      if (s) {
        setPartyType("SELLER");
        setPartyName(s.name);
        setPartyPhone(s.contactInfo);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setOkMsg("");
    try {
      const res = await fetch("/api/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryType,
          partyType,
          partyName,
          partyPhone,
          amountToman: Number(amountToman),
          note,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErr(data.error || "خطا در ثبت سند");
        return;
      }
      setSummary({
        accounts: data.accounts,
        entries: data.entries,
        totalDebtorsToman: data.totalDebtorsToman,
        totalCreditorsToman: data.totalCreditorsToman,
        debtorCount: data.debtorCount,
        creditorCount: data.creditorCount,
        netPositionToman: data.netPositionToman,
      });
      setShowModal(false);
      setOkMsg("سند بدهکار / بستانکار با موفقیت ثبت شد.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteEntry(id: number) {
    if (!window.confirm("این ردیف حساب حذف و مانده آن برگردانده شود؟")) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/ledger/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSummary({
          accounts: data.accounts,
          entries: data.entries,
          totalDebtorsToman: data.totalDebtorsToman,
          totalCreditorsToman: data.totalCreditorsToman,
          debtorCount: data.debtorCount,
          creditorCount: data.creditorCount,
          netPositionToman: data.netPositionToman,
        });
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
            <Wallet className="w-6 h-6 text-emerald-600" />
            <span>وضعیت حساب‌های بدهکار و بستانکار</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            پیگیری لحظه‌ای طلب از خریداران (بدهکاران)، بدهی به فروشندگان (بستانکاران) و ثبت دریافت/پرداخت‌های تسویه
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openNewModal("SETTLE")}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowDownLeft className="w-4 h-4" />
            ثبت دریافت / پرداخت تسویه
          </button>
          <button
            type="button"
            onClick={() => openNewModal("MANUAL")}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            ثبت بدهکار / بستانکار جدید
          </button>
        </div>
      </div>

      {okMsg && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3.5 font-semibold">
          {okMsg}
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>بدهکاران به ما (طلب ما)</span>
            <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-extrabold text-emerald-700 tabular-nums">
            {formatNumberFa(summary.totalDebtorsToman)} ت
          </div>
          <div className="text-[11px] text-slate-500 tabular-nums">
            {formatNumberFa(summary.debtorCount)} حساب بدهکار
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>بستانکاران از ما (بدهی ما)</span>
            <ArrowUpRight className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-xl font-extrabold text-rose-700 tabular-nums">
            {formatNumberFa(summary.totalCreditorsToman)} ت
          </div>
          <div className="text-[11px] text-slate-500 tabular-nums">
            {formatNumberFa(summary.creditorCount)} حساب بستانکار
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>تراز خالص حساب‌ها</span>
            <Wallet className="w-4 h-4 text-sky-600" />
          </div>
          <div
            className={`text-xl font-extrabold tabular-nums ${
              summary.netPositionToman > 0
                ? "text-emerald-700"
                : summary.netPositionToman < 0
                  ? "text-rose-700"
                  : "text-slate-900"
            }`}
          >
            {summary.netPositionToman > 0 ? "+" : summary.netPositionToman < 0 ? "-" : ""}
            {formatNumberFa(Math.abs(summary.netPositionToman))} ت
          </div>
          <div className="text-[11px] text-slate-500">
            {summary.netPositionToman > 0
              ? "خالص طلب ما از بازار"
              : summary.netPositionToman < 0
                ? "خالص بدهی ما به بازار"
                : "تراز برابر / تسویه"}
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>تعداد کل طرف حساب‌ها</span>
            <CheckCircle2 className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 tabular-nums">
            {formatNumberFa(summary.accounts.length)} حساب
          </div>
          <div className="text-[11px] text-slate-500 tabular-nums">
            {formatNumberFa(summary.entries.length)} گردش دریافت/پرداخت
          </div>
        </div>
      </div>

      {/* Filter Tabs + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex flex-wrap rounded-xl bg-white border border-slate-200 p-1 text-xs font-bold gap-1">
          {[
            { id: "ALL", label: `همه (${formatNumberFa(summary.accounts.length)})` },
            {
              id: "DEBTORS",
              label: `بدهکاران (${formatNumberFa(summary.debtorCount)})`,
            },
            {
              id: "CREDITORS",
              label: `بستانکاران (${formatNumberFa(summary.creditorCount)})`,
            },
            { id: "SETTLED", label: "تسویه‌شده" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() =>
                setFilterTab(t.id as "ALL" | "DEBTORS" | "CREDITORS" | "SETTLED")
              }
              className={`px-3.5 py-2 rounded-lg cursor-pointer transition ${
                filterTab === t.id
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجوی نام یا شماره تماس..."
            className="w-full rounded-xl border border-slate-300 bg-white pr-9 pl-3 py-2 text-xs"
          />
        </div>
      </div>

      {/* Accounts Balance Table */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">طرف حساب و نوع</th>
                <th className="py-3 px-3">تلفن</th>
                <th className="py-3 px-3">معاملات</th>
                <th className="py-3 px-3">وضعیت حساب</th>
                <th className="py-3 px-3">مبلغ مانده</th>
                <th className="py-3 px-3">عملیات سریع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAccounts.map((acc) => {
                const isDebtor = acc.netBalanceToman > 0;
                const isCreditor = acc.netBalanceToman < 0;
                return (
                  <tr key={acc.partyKey} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{acc.partyName}</div>
                      <div className="text-[11px] text-slate-500">
                        {PARTY_TYPE_LABELS[acc.partyType]}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 font-mono tabular-nums" dir="ltr">
                      {acc.partyPhone || "—"}
                    </td>
                    <td className="py-3.5 px-3 text-[11px] text-slate-600 tabular-nums">
                      {formatNumberFa(acc.salesCount)} فروش •{" "}
                      {formatNumberFa(acc.purchasesCount)} خرید
                    </td>
                    <td className="py-3.5 px-3">
                      {isDebtor ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                          بدهکار به ما (طلب ما)
                        </span>
                      ) : isCreditor ? (
                        <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-[11px] font-bold">
                          بستانکار از ما (بدهی ما)
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold">
                          تسویه‌شده
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 font-extrabold tabular-nums">
                      <span
                        className={
                          isDebtor
                            ? "text-emerald-700"
                            : isCreditor
                              ? "text-rose-700"
                              : "text-slate-500"
                        }
                      >
                        {formatNumberFa(Math.abs(acc.netBalanceToman))} ت
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      {acc.netBalanceToman !== 0 ? (
                        <button
                          type="button"
                          onClick={() => openQuickSettle(acc)}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold text-white cursor-pointer ${
                            isDebtor
                              ? "bg-emerald-600 hover:bg-emerald-500"
                              : "bg-rose-600 hover:bg-rose-500"
                          }`}
                        >
                          {isDebtor ? "ثبت دریافت وجه" : "ثبت پرداخت وجه"}
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredAccounts.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    هیچ حساب بدهکار یا بستانکاری در این بخش ثبت نشده است.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ledger Audit History */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4 shadow-xs">
        <h2 className="font-bold text-slate-900 text-sm sm:text-base">
          تاریخچه گردش حساب‌ها (دریافت، پرداخت، بدهکاری و بستانکاری)
        </h2>

        <div className="space-y-2">
          {summary.entries.map((entry) => {
            const isPositiveFlow =
              entry.entryType === "RECEIPT_IN" ||
              entry.entryType === "DEBIT_RECEIVABLE";
            return (
              <div
                key={entry.id}
                className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        entry.entryType === "RECEIPT_IN"
                          ? "bg-emerald-100 text-emerald-800"
                          : entry.entryType === "PAYMENT_OUT"
                            ? "bg-sky-100 text-sky-800"
                            : entry.entryType === "DEBIT_RECEIVABLE"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {ENTRY_TYPE_LABELS[entry.entryType]}
                    </span>
                    <span className="font-bold text-slate-900">
                      {entry.partyName}
                    </span>
                    {entry.orderNumber && (
                      <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold tabular-nums">
                        سند {entry.orderNumber}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {entry.note || "بدون توضیح"} •{" "}
                    {formatJalaliDateTime(entry.createdAt)} • توسط{" "}
                    {entry.createdBy || "سیستم"}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`font-extrabold text-sm tabular-nums ${
                      isPositiveFlow ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {formatNumberFa(entry.amountToman)} ت
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDeleteEntry(entry.id)}
                    title="حذف و برگشت این ردیف"
                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
          {summary.entries.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
              هنوز هیچ گردش دریافت یا پرداختی ثبت نشده است.
            </div>
          )}
        </div>
      </div>

      {/* Record Transaction Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-lg rounded-2xl bg-white p-5 space-y-4 shadow-2xl"
          >
            <h3 className="font-bold text-base text-slate-900">
              ثبت سند بدهکار / بستانکار یا تسویه وجه
            </h3>

            {err && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3">
                {err}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  انتخاب از خریداران / فروشندگان ثبت‌شده (اختیاری)
                </label>
                <select
                  defaultValue=""
                  onChange={(e) => handleSelectPreset(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  <option value="">— وارد کردن دستی نام طرف حساب —</option>
                  {buyers.length > 0 && (
                    <optgroup label="خریداران (فروش ما)">
                      {buyers.map((b) => (
                        <option key={`B-${b.id}`} value={`BUYER:${b.id}`}>
                          {b.name} ({b.phone})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {sellers.length > 0 && (
                    <optgroup label="فروشندگان / دلال‌ها (خرید ما)">
                      {sellers.map((s) => (
                        <option key={`S-${s.id}`} value={`SELLER:${s.id}`}>
                          {s.name} ({s.contactInfo || s.city})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  نوع ثبت *
                </label>
                <select
                  value={entryType}
                  onChange={(e) => setEntryType(e.target.value as LedgerEntryType)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  <option value="RECEIPT_IN">دریافت وجه از بدهکار (تسویه طلب ما)</option>
                  <option value="PAYMENT_OUT">پرداخت وجه به بستانکار (تسویه بدهی ما)</option>
                  <option value="DEBIT_RECEIVABLE">ثبت بدهکاری جدید (طرف حساب بدهکار شد)</option>
                  <option value="CREDIT_PAYABLE">ثبت بستانکاری جدید (ما بدهکار شدیم)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  گروه طرف حساب
                </label>
                <select
                  value={partyType}
                  onChange={(e) => setPartyType(e.target.value as PartyType)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  <option value="BUYER">خریدار</option>
                  <option value="SELLER">فروشنده / دلال</option>
                  <option value="OTHER">سایر / متفرقه</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  نام طرف حساب *
                </label>
                <input
                  required
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  placeholder="مثلاً: حسین بلوچی"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  شماره تماس (برای تطبیق خودکار)
                </label>
                <input
                  dir="ltr"
                  value={partyPhone}
                  onChange={(e) => setPartyPhone(e.target.value)}
                  placeholder="09151112233"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  مبلغ (تومان) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  dir="ltr"
                  value={amountToman}
                  onChange={(e) => setAmountToman(e.target.value)}
                  placeholder="10000000"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  شرح / بابت (شماره کارت، چک، حواله و...)
                </label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="مثلاً: واریز کارت به کارت بابت بخشی از بدهی"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
              >
                {busy ? "در حال ثبت..." : "ثبت در دفتر حساب"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
