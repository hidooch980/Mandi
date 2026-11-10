"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Download,
  Fuel,
  MapPin,
  PieChart,
  Plus,
  Printer,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { formatJalaliDate, formatNumberFa } from "@/lib/jalali";
import {
  buildComprehensiveReport,
  EXPENSE_CATEGORY_LABELS,
  getTehranDateString,
} from "@/lib/reports";
import type {
  ExpenseCategory,
  ExpenseRecord,
  LedgerSummary,
  Order,
  Product,
} from "@/lib/types";

type ReportTab = "PNL" | "FUELS" | "DAILY" | "PARTIES" | "INVENTORY_CITY";

function shiftDays(tehranDateStr: string, days: number): string {
  const d = new Date(`${tehranDateStr}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function ReportsClient({
  orders,
  initialExpenses,
  products,
  ledgerSummary,
}: {
  orders: Order[];
  initialExpenses: ExpenseRecord[];
  products: Product[];
  ledgerSummary: LedgerSummary;
}) {
  const todayStr = getTehranDateString(new Date());
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(initialExpenses);
  const [tab, setTab] = useState<ReportTab>("PNL");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Expense form
  const [expTitle, setExpTitle] = useState("");
  const [expCategory, setExpCategory] = useState<ExpenseCategory>("FREIGHT");
  const [expAmount, setExpAmount] = useState("");
  const [expDate, setExpDate] = useState(todayStr);
  const [expNote, setExpNote] = useState("");

  const report = useMemo(
    () =>
      buildComprehensiveReport({
        orders,
        expenses,
        products,
        ledgerSummary,
        dateFrom,
        dateTo,
      }),
    [orders, expenses, products, ledgerSummary, dateFrom, dateTo]
  );

  const filteredExpenses = useMemo(
    () =>
      expenses.filter((e) => {
        const d = getTehranDateString(e.expenseDate || e.createdAt);
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
        return true;
      }),
    [expenses, dateFrom, dateTo]
  );

  function applyPreset(preset: "TODAY" | "7D" | "30D" | "ALL") {
    if (preset === "ALL") {
      setDateFrom("");
      setDateTo("");
      return;
    }
    setDateTo(todayStr);
    if (preset === "TODAY") setDateFrom(todayStr);
    else if (preset === "7D") setDateFrom(shiftDays(todayStr, -6));
    else setDateFrom(shiftDays(todayStr, -29));
  }

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: expTitle,
          category: expCategory,
          amountToman: Number(expAmount),
          expenseDate: expDate,
          note: expNote,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErr(data.error || "خطا در ثبت هزینه");
        return;
      }
      setExpenses(data.expenses);
      setShowExpenseModal(false);
      setExpTitle("");
      setExpAmount("");
      setExpNote("");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteExpense(id: number) {
    if (!window.confirm("این هزینه از گزارش سود و زیان حذف شود؟")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.ok) {
        setExpenses(data.expenses);
      }
    } finally {
      setBusy(false);
    }
  }

  function exportCsvReport() {
    const lines: string[] = [];
    lines.push("گزارش مالی و سود و زیان پترونبض");
    lines.push(
      `بازه گزارش,${dateFrom || "ابتدا"},تا,${dateTo || "امروز"}`
    );
    lines.push("");
    lines.push("خلاصه سود و زیان,مبلغ (تومان)");
    lines.push(`کل درآمد فروش (${report.pnl.salesCount} معامله),${report.pnl.totalSalesToman}`);
    lines.push(`کل خریدهای دوره (${report.pnl.purchasesCount} معامله),${report.pnl.totalPurchasesToman}`);
    lines.push(`بهای تمام‌شده کالای فروش‌رفته,${report.pnl.totalCostOfGoodsToman}`);
    lines.push(`سود ناخالص معاملات,${report.pnl.grossProfitToman}`);
    lines.push(`مجموع هزینه‌های جاری و عملیاتی,${report.pnl.totalExpensesToman}`);
    lines.push(`سود / زیان خالص نهایی,${report.pnl.netProfitToman}`);
    lines.push("");
    lines.push("تفکیک فرآورده,تعداد فروش (واحد),لیتر فروش,مبلغ فروش (تومان),سود ناخالص (تومان)");
    for (const f of report.byFuel) {
      lines.push(
        `${f.label},${f.soldBarrels},${f.soldLiters},${f.soldAmountToman},${f.grossProfitToman}`
      );
    }
    lines.push("");
    lines.push("روند روزانه,فروش (تومان),خرید (تومان),هزینه (تومان),سود خالص (تومان)");
    for (const d of report.daily) {
      lines.push(
        `${d.jalaliLabel},${d.salesToman},${d.purchasesToman},${d.expensesToman},${d.netProfitToman}`
      );
    }

    const blob = new Blob(["\uFEFF" + lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `petronabz-pnl-report-${todayStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const maxDailyVal = Math.max(
    ...report.daily.map((d) => Math.max(d.salesToman, d.purchasesToman, Math.abs(d.netProfitToman))),
    1
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <PieChart className="w-6 h-6 text-emerald-600" />
            <span>سود و زیان و گزارشات تحلیلی</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            صورت سود و زیان خالص، مقایسه بنزین و گازوئیل، روند روزانه، مشتریان برتر، ارزش انبار و خروجی اکسل/PDF
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setErr("");
              setShowExpenseModal(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            ثبت هزینه جاری
          </button>
          <button
            type="button"
            onClick={exportCsvReport}
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4 text-sky-600" />
            خروجی اکسل (CSV)
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            چاپ / PDF
          </button>
        </div>
      </div>

      {/* Print-only Header */}
      <div className="hidden print-only border-b-2 border-slate-900 pb-3 mb-4">
        <h1 className="text-lg font-extrabold text-slate-900">
          گزارش رسمی سود و زیان و عملکرد — پترونبض
        </h1>
        <p className="text-xs text-slate-600 mt-1">
          بازه گزارش: {dateFrom ? formatJalaliDate(`${dateFrom}T12:00:00Z`) : "ابتدای دوره"} تا{" "}
          {dateTo ? formatJalaliDate(`${dateTo}T12:00:00Z`) : formatJalaliDate(new Date())}
        </p>
      </div>

      {/* Date Filters */}
      <div className="no-print rounded-2xl bg-white border border-slate-200 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          <span className="text-slate-500 ml-1">بازه سریع:</span>
          {[
            { label: "همه دوره‌ها", action: () => applyPreset("ALL"), active: !dateFrom && !dateTo },
            { label: "امروز", action: () => applyPreset("TODAY"), active: dateFrom === todayStr && dateTo === todayStr },
            { label: "۷ روز اخیر", action: () => applyPreset("7D"), active: dateFrom === shiftDays(todayStr, -6) && dateTo === todayStr },
            { label: "۳۰ روز اخیر", action: () => applyPreset("30D"), active: dateFrom === shiftDays(todayStr, -29) && dateTo === todayStr },
          ].map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={p.action}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition ${
                p.active
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="text-slate-600 font-semibold">از:</label>
          <input
            type="date"
            dir="ltr"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5"
          />
          <label className="text-slate-600 font-semibold">تا:</label>
          <input
            type="date"
            dir="ltr"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5"
          />
          {(dateFrom || dateTo) && (
            <span className="text-[11px] text-emerald-700 font-semibold tabular-nums">
              ({dateFrom ? formatJalaliDate(`${dateFrom}T12:00:00Z`) : "…"} تا{" "}
              {dateTo ? formatJalaliDate(`${dateTo}T12:00:00Z`) : "…"})
            </span>
          )}
        </div>
      </div>

      {/* Top P&L Highlight Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>درآمد کل فروش ({formatNumberFa(report.pnl.salesCount)} سند)</span>
            <TrendingUp className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 tabular-nums">
            {formatNumberFa(report.pnl.totalSalesToman)} ت
          </div>
          <div className="text-[11px] text-slate-500 tabular-nums">
            بهای تمام‌شده: {formatNumberFa(report.pnl.totalCostOfGoodsToman)} ت
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>سود ناخالص معاملات</span>
            <BarChart3 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-extrabold text-emerald-700 tabular-nums">
            +{formatNumberFa(report.pnl.grossProfitToman)} ت
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold tabular-nums">
            حاشیه سود ناخالص: {formatNumberFa(report.pnl.grossMarginPercent, 1)}٪
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>هزینه‌های جاری و عملیاتی</span>
            <TrendingDown className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-xl font-extrabold text-rose-700 tabular-nums">
            -{formatNumberFa(report.pnl.totalExpensesToman)} ت
          </div>
          <div className="text-[11px] text-slate-500 tabular-nums">
            {formatNumberFa(filteredExpenses.length)} ردیف هزینه در بازه
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>سود / زیان خالص نهایی</span>
            <Wallet className="w-4 h-4 text-amber-500" />
          </div>
          <div
            className={`text-xl font-extrabold tabular-nums ${
              report.pnl.netProfitToman >= 0
                ? "text-emerald-700"
                : "text-rose-700"
            }`}
          >
            {report.pnl.netProfitToman >= 0 ? "+" : "-"}
            {formatNumberFa(Math.abs(report.pnl.netProfitToman))} ت
          </div>
          <div className="text-[11px] font-semibold tabular-nums text-slate-500">
            {report.pnl.netProfitToman >= 0 ? "سود خالص" : "زیان خالص"} (
            {formatNumberFa(Math.abs(report.pnl.netMarginPercent), 1)}٪)
          </div>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="no-print flex flex-wrap gap-1.5 rounded-2xl bg-white border border-slate-200 p-1.5 text-xs font-bold shadow-xs">
        {[
          { id: "PNL", label: "صورت سود و زیان و هزینه‌ها", icon: PieChart },
          { id: "FUELS", label: "گزارش بنزین در برابر گازوئیل", icon: Fuel },
          { id: "DAILY", label: "روند روزانه و نمودار سود", icon: BarChart3 },
          { id: "PARTIES", label: "برترین مشتریان و فروشندگان", icon: Users },
          { id: "INVENTORY_CITY", label: "ارزش انبار، شهرها و مالی", icon: MapPin },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as ReportTab)}
              className={`px-3.5 py-2 rounded-xl inline-flex items-center gap-1.5 cursor-pointer transition ${
                tab === t.id
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Comprehensive P&L & Expenses */}
      {tab === "PNL" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 rounded-2xl bg-white border border-slate-200 p-5 space-y-4 shadow-xs">
            <h2 className="font-bold text-slate-900 text-sm sm:text-base border-b border-slate-100 pb-3">
              صورت حساب سود و زیان دوره (P&amp;L)
            </h2>
            <div className="space-y-2.5 text-xs sm:text-sm tabular-nums">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">جمع درآمد فروش بنزین و گازوئیل</span>
                <span className="font-bold text-slate-900">
                  +{formatNumberFa(report.pnl.totalSalesToman)} تومان
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">بهای تمام‌شده کالای فروش‌رفته</span>
                <span className="font-bold text-rose-700">
                  -{formatNumberFa(report.pnl.totalCostOfGoodsToman)} تومان
                </span>
              </div>
              <div className="flex justify-between py-2.5 rounded-xl bg-emerald-50 px-3 font-extrabold text-emerald-900">
                <span>سود ناخالص معاملات</span>
                <span>+{formatNumberFa(report.pnl.grossProfitToman)} تومان</span>
              </div>

              <div className="pt-2 space-y-1.5">
                <div className="text-xs font-bold text-slate-700">
                  کسر هزینه‌های جاری ثبت‌شده:
                </div>
                {report.pnl.expensesByCategory.length === 0 ? (
                  <div className="text-xs text-slate-400 py-2">
                    هزینه جاری در این بازه ثبت نشده است.
                  </div>
                ) : (
                  report.pnl.expensesByCategory.map((c) => (
                    <div
                      key={c.category}
                      className="flex justify-between text-xs py-1 px-2 rounded bg-slate-50"
                    >
                      <span className="text-slate-600">
                        {c.label} ({formatNumberFa(c.count)} مورد)
                      </span>
                      <span className="font-bold text-rose-700">
                        -{formatNumberFa(c.amountToman)} ت
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div
                className={`flex justify-between py-3 px-4 rounded-xl text-sm sm:text-base font-extrabold border ${
                  report.pnl.netProfitToman >= 0
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                    : "bg-rose-50 border-rose-200 text-rose-900"
                }`}
              >
                <span>
                  {report.pnl.netProfitToman >= 0
                    ? "سود خالص نهایی دوره"
                    : "زیان خالص نهایی دوره"}
                </span>
                <span>
                  {report.pnl.netProfitToman >= 0 ? "+" : "-"}
                  {formatNumberFa(Math.abs(report.pnl.netProfitToman))} تومان
                </span>
              </div>

              <div className="text-[11px] text-slate-500 pt-1 flex justify-between">
                <span>جمع خرید ورودی انبار در این بازه:</span>
                <span className="font-bold">
                  {formatNumberFa(report.pnl.totalPurchasesToman)} تومان
                </span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 rounded-2xl bg-white border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-bold text-slate-900 text-sm sm:text-base">
                ریز هزینه‌های جاری (اجاره، حقوق، حمل، ضایعات)
              </h2>
              <button
                type="button"
                onClick={() => {
                  setErr("");
                  setShowExpenseModal(true);
                }}
                className="no-print text-xs font-bold text-rose-700 hover:underline cursor-pointer"
              >
                + ثبت هزینه جدید
              </button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredExpenses.map((exp) => (
                <div
                  key={exp.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">
                        {EXPENSE_CATEGORY_LABELS[exp.category]}
                      </span>
                      <span className="font-bold text-slate-900">{exp.title}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 tabular-nums">
                      تاریخ: {formatJalaliDate(`${exp.expenseDate}T12:00:00Z`)} •{" "}
                      {exp.note || "بدون شرح"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-extrabold text-rose-700 tabular-nums">
                      -{formatNumberFa(exp.amountToman)} ت
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleDeleteExpense(exp.id)}
                      className="no-print p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {filteredExpenses.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                  هیچ هزینه‌ای در این بازه ثبت نشده است. برای محاسبه سود خالص دقیق، هزینه‌هایی مثل کرایه یا اجاره انبار را ثبت کنید.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Diesel vs Gasoline Report */}
      {tab === "FUELS" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {report.byFuel.map((f) => (
              <div
                key={f.fuelType}
                className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4 shadow-xs"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h2 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <Fuel
                      className={`w-5 h-5 ${
                        f.fuelType === "DIESEL"
                          ? "text-emerald-600"
                          : "text-amber-500"
                      }`}
                    />
                    <span>گزارش عملکرد {f.label}</span>
                  </h2>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold tabular-nums">
                    سهم سود: {formatNumberFa(f.profitSharePercent, 1)}٪
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs tabular-nums">
                  <div className="rounded-xl bg-slate-50 p-3 space-y-1">
                    <div className="text-slate-500">حجم فروش ({formatNumberFa(f.salesCount)} معامله)</div>
                    <div className="font-extrabold text-slate-900 text-sm">
                      {formatNumberFa(f.soldBarrels)} بشکه/واحد
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {formatNumberFa(f.soldLiters)} لیتر • {f.soldTons} تن
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 space-y-1">
                    <div className="text-slate-500">حجم خرید ({formatNumberFa(f.purchasesCount)} معامله)</div>
                    <div className="font-extrabold text-slate-900 text-sm">
                      {formatNumberFa(f.purchasedBarrels)} بشکه/واحد
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {formatNumberFa(f.purchasedLiters)} لیتر • {f.purchasedTons} تن
                    </div>
                  </div>
                  <div className="rounded-xl bg-sky-50 p-3 space-y-1">
                    <div className="text-sky-700">میانگین فروش هر واحد</div>
                    <div className="font-extrabold text-sky-900">
                      {formatNumberFa(f.avgSellPerBarrelToman)} ت
                    </div>
                    <div className="text-[11px] text-sky-700">
                      جمع فروش: {formatNumberFa(f.soldAmountToman)} ت
                    </div>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-3 space-y-1">
                    <div className="text-amber-700">میانگین خرید هر واحد</div>
                    <div className="font-extrabold text-amber-900">
                      {formatNumberFa(f.avgBuyPerBarrelToman)} ت
                    </div>
                    <div className="text-[11px] text-amber-700">
                      جمع خرید: {formatNumberFa(f.purchasedAmountToman)} ت
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 flex items-center justify-between text-xs sm:text-sm font-extrabold text-emerald-900 tabular-nums">
                  <span>سود ناخالص {f.label}:</span>
                  <span>+{formatNumberFa(f.grossProfitToman)} تومان</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Daily Trend Chart & Table */}
      {tab === "DAILY" && (
        <div className="space-y-5">
          <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4 shadow-xs">
            <h2 className="font-bold text-slate-900 text-sm sm:text-base">
              نمودار مقایسه فروش، خرید و سود خالص روزانه
            </h2>
            {report.daily.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                معامله یا هزینه‌ای برای رسم نمودار در این بازه ثبت نشده است.
              </div>
            ) : (
              <div className="space-y-3">
                {report.daily.map((d) => (
                  <div key={d.dateKey} className="space-y-1 text-xs tabular-nums">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-slate-900">
                        {d.jalaliLabel}
                      </span>
                      <div className="flex flex-wrap gap-3 text-[11px]">
                        <span className="text-sky-700">
                          فروش: {formatNumberFa(d.salesToman)} ت
                        </span>
                        <span className="text-indigo-700">
                          خرید: {formatNumberFa(d.purchasesToman)} ت
                        </span>
                        <span
                          className={`font-extrabold ${
                            d.netProfitToman >= 0
                              ? "text-emerald-700"
                              : "text-rose-700"
                          }`}
                        >
                          سود خالص: {d.netProfitToman >= 0 ? "+" : "-"}
                          {formatNumberFa(Math.abs(d.netProfitToman))} ت
                        </span>
                      </div>
                    </div>
                    <div className="h-3 rounded-full bg-slate-100 overflow-hidden flex gap-0.5">
                      <div
                        style={{
                          width: `${Math.min(100, (d.salesToman / maxDailyVal) * 100)}%`,
                        }}
                        className="bg-sky-500 h-full"
                        title={`فروش: ${formatNumberFa(d.salesToman)}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">تاریخ شمسی</th>
                    <th className="py-3 px-3">فروش (تعداد / واحد)</th>
                    <th className="py-3 px-3">مبلغ فروش</th>
                    <th className="py-3 px-3">مبلغ خرید</th>
                    <th className="py-3 px-3">سود ناخالص</th>
                    <th className="py-3 px-3">هزینه روز</th>
                    <th className="py-3 px-3">سود / زیان خالص</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {report.daily.map((d) => (
                    <tr key={d.dateKey} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {d.jalaliLabel}
                      </td>
                      <td className="py-3 px-3">
                        {formatNumberFa(d.salesCount)} سند ({formatNumberFa(d.soldBarrels)} واحد)
                      </td>
                      <td className="py-3 px-3 font-bold text-sky-700">
                        {formatNumberFa(d.salesToman)} ت
                      </td>
                      <td className="py-3 px-3 text-indigo-700">
                        {formatNumberFa(d.purchasesToman)} ت
                      </td>
                      <td className="py-3 px-3 font-bold text-emerald-700">
                        +{formatNumberFa(d.grossProfitToman)} ت
                      </td>
                      <td className="py-3 px-3 text-rose-700">
                        -{formatNumberFa(d.expensesToman)} ت
                      </td>
                      <td
                        className={`py-3 px-3 font-extrabold ${
                          d.netProfitToman >= 0
                            ? "text-emerald-700"
                            : "text-rose-700"
                        }`}
                      >
                        {d.netProfitToman >= 0 ? "+" : "-"}
                        {formatNumberFa(Math.abs(d.netProfitToman))} ت
                      </td>
                    </tr>
                  ))}
                  {report.daily.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        رکورد روزانه‌ای در این بازه وجود ندارد.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Top Buyers & Sellers */}
      {tab === "PARTIES" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 font-bold text-slate-900 text-sm">
              رتبه‌بندی برترین خریداران (مشتریان ما)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">خریدار</th>
                    <th className="py-2.5 px-3">واحد/بشکه</th>
                    <th className="py-2.5 px-3">حجم فروش</th>
                    <th className="py-2.5 px-3">سود ما از او</th>
                    <th className="py-2.5 px-3">مانده حساب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {report.topBuyers.map((b) => (
                    <tr key={b.partyKey}>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{b.partyName}</div>
                        <div className="text-[11px] text-slate-500" dir="ltr">
                          {b.partyPhone || "—"}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-bold">
                        {formatNumberFa(b.barrels)}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900">
                        {formatNumberFa(b.totalToman)} ت
                      </td>
                      <td className="py-3 px-3 font-bold text-emerald-700">
                        +{formatNumberFa(b.grossProfitToman)} ت
                      </td>
                      <td className="py-3 px-3">
                        {b.netBalanceToman > 0 ? (
                          <span className="text-emerald-700 font-bold">
                            بدهکار {formatNumberFa(b.netBalanceToman)}
                          </span>
                        ) : b.netBalanceToman < 0 ? (
                          <span className="text-rose-700 font-bold">
                            بستانکار {formatNumberFa(Math.abs(b.netBalanceToman))}
                          </span>
                        ) : (
                          <span className="text-slate-400">تسویه</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {report.topBuyers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        فروشی در این بازه ثبت نشده است.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 font-bold text-slate-900 text-sm">
              رتبه‌بندی فروشندگان و تامین‌کنندگان (خرید ما)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">فروشنده</th>
                    <th className="py-2.5 px-3">تعداد خرید</th>
                    <th className="py-2.5 px-3">واحد/بشکه</th>
                    <th className="py-2.5 px-3">مبلغ خرید</th>
                    <th className="py-2.5 px-3">مانده حساب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {report.topSellers.map((s) => (
                    <tr key={s.partyKey}>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{s.partyName}</div>
                        <div className="text-[11px] text-slate-500" dir="ltr">
                          {s.partyPhone || "—"}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-bold">
                        {formatNumberFa(s.tradeCount)}
                      </td>
                      <td className="py-3 px-3 font-bold">
                        {formatNumberFa(s.barrels)}
                      </td>
                      <td className="py-3 px-3 font-bold text-indigo-700">
                        {formatNumberFa(s.totalToman)} ت
                      </td>
                      <td className="py-3 px-3">
                        {s.netBalanceToman < 0 ? (
                          <span className="text-rose-700 font-bold">
                            بستانکار {formatNumberFa(Math.abs(s.netBalanceToman))}
                          </span>
                        ) : s.netBalanceToman > 0 ? (
                          <span className="text-emerald-700 font-bold">
                            بدهکار {formatNumberFa(s.netBalanceToman)}
                          </span>
                        ) : (
                          <span className="text-slate-400">تسویه</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {report.topSellers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        خریدی در این بازه ثبت نشده است.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Inventory Valuation, Cities & Receivables/Payables */}
      {tab === "INVENTORY_CITY" && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="font-bold text-slate-900 text-sm sm:text-base">
                ارزش ریالی موجودی فعلی انبار (سرمایه در گردش کالا)
              </h2>
              <div className="text-xs font-bold tabular-nums flex flex-wrap gap-3">
                <span className="text-slate-600">
                  ارزش تمام‌شده: {formatNumberFa(report.totalInventoryCostToman)} ت
                </span>
                <span className="text-emerald-700">
                  ارزش فروش روز: {formatNumberFa(report.totalInventoryRetailToman)} ت
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">کالا</th>
                    <th className="py-2.5 px-3">موجودی کل / رزرو</th>
                    <th className="py-2.5 px-3">حجم (لیتر)</th>
                    <th className="py-2.5 px-3">ارزش به نرخ خرید</th>
                    <th className="py-2.5 px-3">ارزش به نرخ فروش</th>
                    <th className="py-2.5 px-3">سود بالقوه موجودی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {report.inventoryValuation.map((inv) => (
                    <tr key={inv.productId}>
                      <td className="py-3 px-3 font-bold text-slate-900">
                        {inv.name}
                      </td>
                      <td className="py-3 px-3">
                        {formatNumberFa(inv.stockBarrels)} (رزرو: {formatNumberFa(inv.reservedBarrels)})
                      </td>
                      <td className="py-3 px-3">
                        {formatNumberFa(inv.totalLiters)} لیتر
                      </td>
                      <td className="py-3 px-3 font-semibold">
                        {formatNumberFa(inv.costValuationToman)} ت
                      </td>
                      <td className="py-3 px-3 font-bold text-sky-700">
                        {formatNumberFa(inv.retailValuationToman)} ت
                      </td>
                      <td className="py-3 px-3 font-bold text-emerald-700">
                        +{formatNumberFa(inv.potentialProfitToman)} ت
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-3 shadow-xs">
              <h2 className="font-bold text-slate-900 text-sm">
                گزارش فروش به تفکیک شهر مقصد
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">شهر</th>
                      <th className="py-2 px-3">تعداد فروش</th>
                      <th className="py-2 px-3">واحد / لیتر</th>
                      <th className="py-2 px-3">جمع فروش</th>
                      <th className="py-2 px-3">سود</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 tabular-nums">
                    {report.byCity.map((c) => (
                      <tr key={c.city}>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {c.city}
                        </td>
                        <td className="py-2.5 px-3">{formatNumberFa(c.salesCount)}</td>
                        <td className="py-2.5 px-3">
                          {formatNumberFa(c.soldBarrels)} ({formatNumberFa(c.soldLiters)} L)
                        </td>
                        <td className="py-2.5 px-3 font-bold">
                          {formatNumberFa(c.totalSalesToman)} ت
                        </td>
                        <td className="py-2.5 px-3 font-bold text-emerald-700">
                          +{formatNumberFa(c.grossProfitToman)} ت
                        </td>
                      </tr>
                    ))}
                    {report.byCity.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400">
                          فروشی برای تفکیک شهر ثبت نشده است.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-900 text-sm">
                  تراز بدهکاران و بستانکاران فعلی
                </h2>
                <Link
                  href="/ledger"
                  className="text-xs font-bold text-emerald-700 hover:underline"
                >
                  باز کردن دفتر حساب ←
                </Link>
              </div>
              <div className="space-y-2.5 text-xs tabular-nums">
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 flex justify-between">
                  <span className="text-emerald-800">
                    طلب ما از بدهکاران ({formatNumberFa(ledgerSummary.debtorCount)} نفر)
                  </span>
                  <span className="font-extrabold text-emerald-900">
                    {formatNumberFa(ledgerSummary.totalDebtorsToman)} ت
                  </span>
                </div>
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 flex justify-between">
                  <span className="text-rose-800">
                    بدهی ما به بستانکاران ({formatNumberFa(ledgerSummary.creditorCount)} نفر)
                  </span>
                  <span className="font-extrabold text-rose-900">
                    {formatNumberFa(ledgerSummary.totalCreditorsToman)} ت
                  </span>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 flex justify-between font-extrabold">
                  <span>تراز خالص بدهکار و بستانکار</span>
                  <span
                    className={
                      ledgerSummary.netPositionToman >= 0
                        ? "text-emerald-700"
                        : "text-rose-700"
                    }
                  >
                    {ledgerSummary.netPositionToman >= 0 ? "+" : "-"}
                    {formatNumberFa(Math.abs(ledgerSummary.netPositionToman))} ت
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Operating Expense Modal */}
      {showExpenseModal && (
        <div className="no-print fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleAddExpense}
            className="w-full max-w-md rounded-2xl bg-white p-5 space-y-4 shadow-2xl"
          >
            <h3 className="font-bold text-base text-slate-900">
              ثبت هزینه جاری برای کسر در سود و زیان
            </h3>
            {err && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3">
                {err}
              </div>
            )}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  عنوان هزینه *
                </label>
                <input
                  required
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value)}
                  placeholder="مثلاً: اجاره جایگاه / کرایه تانکر / حقوق انباردار"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  دسته‌بندی
                </label>
                <select
                  value={expCategory}
                  onChange={(e) =>
                    setExpCategory(e.target.value as ExpenseCategory)
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    مبلغ (تومان) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    dir="ltr"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    placeholder="2500000"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    تاریخ هزینه
                  </label>
                  <input
                    type="date"
                    dir="ltr"
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  توضیحات (اختیاری)
                </label>
                <input
                  value={expNote}
                  onChange={(e) => setExpNote(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowExpenseModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
              >
                {busy ? "در حال ثبت..." : "ثبت هزینه"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
