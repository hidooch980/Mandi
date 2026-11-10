"use client";

import { useEffect, useState } from "react";
import {
  DatabaseBackup,
  Download,
  KeyRound,
  Laptop,
  Settings,
  Smartphone,
} from "lucide-react";
import { SAMPLE_IMPORT_CSV } from "@/lib/csv-importer";
import type { MarketConfig } from "@/lib/types";

export function SettingsClient({
  initialConfig,
}: {
  initialConfig: MarketConfig;
}) {
  const [cfg, setCfg] = useState<MarketConfig>(initialConfig);
  const [busy, setBusy] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );
  const [appVersion, setAppVersion] = useState<{
    versionCode: number;
    versionName: string;
    apkAvailable: boolean;
    apkUrl: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/app-version")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setAppVersion(d);
      })
      .catch(() => {});
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSavedMsg("");
    try {
      const res = await fetch("/api/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      const data = await res.json();
      if (data.ok) {
        setCfg(data.config);
        setSavedMsg("تنظیمات بنزین و گازوئیل و سربرگ اسناد با موفقیت ذخیره شد.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdMsg(null);
    if (newPassword.trim().length < 6) {
      setPwdMsg({ type: "err", text: "رمز عبور جدید باید حداقل ۶ کاراکتر باشد." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdMsg({ type: "err", text: "رمز عبور جدید و تکرار آن یکسان نیستند." });
      return;
    }
    setPwdBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword: newPassword.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwdMsg({
          type: "err",
          text: data.error || "خطا در تغییر رمز عبور",
        });
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwdMsg({ type: "ok", text: "رمز عبور با موفقیت تغییر یافت." });
    } finally {
      setPwdBusy(false);
    }
  }

  function downloadSampleCsv() {
    const blob = new Blob(["\uFEFF" + SAMPLE_IMPORT_CSV], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "diesel-inquiries-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Settings className="w-6 h-6 text-slate-700" />
            <span>تنظیمات، تغییر رمز و پشتیبان‌گیری</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            تنظیم سود و نرخ‌ها، امنیت حساب، دانلود بکاپ دیتابیس و نصب اپلیکیشن موبایل
          </p>
        </div>

        <a
          href="/api/backup"
          className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
        >
          <DatabaseBackup className="w-4 h-4" />
          دانلود بکاپ کامل اطلاعات (JSON)
        </a>
      </div>

      {savedMsg && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3.5 font-semibold">
          {savedMsg}
        </div>
      )}

      {/* Main Config Form */}
      <form
        onSubmit={handleSave}
        className="rounded-2xl bg-white border border-slate-200 p-5 space-y-5 shadow-xs"
      >
        <h2 className="font-bold text-slate-900 text-sm sm:text-base border-b border-slate-100 pb-3">
          پارامترهای فنی بنزین و گازوئیل و سربرگ فاکتور
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              عنوان رسمی فروشنده در سند
            </label>
            <input
              value={cfg.companyTitle}
              onChange={(e) => setCfg({ ...cfg, companyTitle: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              تلفن تماس
            </label>
            <input
              value={cfg.companyPhone}
              onChange={(e) => setCfg({ ...cfg, companyPhone: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              شناسه / کد اقتصادی
            </label>
            <input
              dir="ltr"
              value={cfg.companyEconomicCode}
              onChange={(e) =>
                setCfg({ ...cfg, companyEconomicCode: e.target.value })
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block font-semibold text-slate-700 mb-1">
              نشانی کامل
            </label>
            <input
              value={cfg.companyAddress}
              onChange={(e) => setCfg({ ...cfg, companyAddress: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              سود ثابت هر بشکه گازوئیل (تومان)
            </label>
            <input
              type="number"
              dir="ltr"
              value={cfg.fixedProfitPerBarrelToman}
              onChange={(e) =>
                setCfg({
                  ...cfg,
                  fixedProfitPerBarrelToman: Number(e.target.value),
                })
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              نرخ فروش بشکه گازوئیل (تومان)
            </label>
            <input
              type="number"
              dir="ltr"
              value={cfg.publishedDieselBarrelToman}
              onChange={(e) =>
                setCfg({
                  ...cfg,
                  publishedDieselBarrelToman: Number(e.target.value),
                })
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              نرخ فروش بنزین ۷۰ لیتری (تومان)
            </label>
            <input
              type="number"
              dir="ltr"
              value={cfg.publishedGasolineBarrelToman}
              onChange={(e) =>
                setCfg({
                  ...cfg,
                  publishedGasolineBarrelToman: Number(e.target.value),
                })
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              نرخ دلار مبنا (تومان)
            </label>
            <input
              type="number"
              dir="ltr"
              value={cfg.usdToToman}
              onChange={(e) =>
                setCfg({ ...cfg, usdToToman: Number(e.target.value) })
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              چگالی گازوئیل (kg/L)
            </label>
            <input
              type="number"
              step="0.005"
              dir="ltr"
              value={cfg.dieselDensity}
              onChange={(e) =>
                setCfg({ ...cfg, dieselDensity: Number(e.target.value) })
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              چگالی بنزین (kg/L)
            </label>
            <input
              type="number"
              step="0.005"
              dir="ltr"
              value={cfg.gasolineDensity}
              onChange={(e) =>
                setCfg({ ...cfg, gasolineDensity: Number(e.target.value) })
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </div>
        </div>

        <div className="flex flex-wrap justify-between items-center gap-3 pt-2">
          <button
            type="button"
            onClick={downloadSampleCsv}
            className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4 text-sky-600" />
            دانلود فایل نمونه استعلام گازوئیل (CSV)
          </button>

          <button
            type="submit"
            disabled={busy}
            className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold cursor-pointer"
          >
            {busy ? "در حال ذخیره..." : "ذخیره تنظیمات"}
          </button>
        </div>
      </form>

      <form
        onSubmit={handleChangePassword}
        className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4 shadow-xs"
      >
        <h2 className="font-bold text-slate-900 text-sm sm:text-base border-b border-slate-100 pb-3 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-emerald-600" />
          <span>تغییر رمز عبور حساب من</span>
        </h2>

        {pwdMsg && (
          <div
            className={`rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${
              pwdMsg.type === "ok"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-700"
            }`}
          >
            {pwdMsg.text}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              رمز عبور فعلی
            </label>
            <input
              type="password"
              required
              dir="ltr"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              رمز عبور جدید (حداقل ۶ کاراکتر)
            </label>
            <input
              type="password"
              required
              dir="ltr"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              تکرار رمز عبور جدید
            </label>
            <input
              type="password"
              required
              dir="ltr"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pwdBusy}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
          >
            {pwdBusy ? "در حال ثبت..." : "تغییر رمز عبور"}
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-2.5">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
            <Laptop className="w-5 h-5 text-emerald-600" />
            <span>نصب روی ویندوز، مک و لینوکس (لپ‌تاپ و کامپیوتر)</span>
          </div>
          <p className="text-xs text-slate-600 leading-6">
            برنامه را در <strong>Chrome</strong> یا <strong>Edge</strong> باز کرده و
            آیکون نصب (<strong>Install App</strong>) در نوار آدرس را بزنید تا
            به‌صورت نرم‌افزار مستقل دسکتاپ نصب شود.
          </p>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <Smartphone className="w-5 h-5 text-amber-600" />
              <span>اپلیکیشن اندروید (APK امضاشده) و وب‌اپ آیفون</span>
            </div>
            {appVersion && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                نسخه {appVersion.versionName}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 leading-6">
            <strong>اندروید:</strong> فایل نصبی امضاشده و قابل بروزرسانی را مستقیم دانلود و نصب کنید.
            <br />
            <strong>آیفون (iOS Web App):</strong> در مرورگر <strong>Safari</strong> باز کرده، دکمه <strong>Share</strong> و سپس <strong>Add to Home Screen</strong> را بزنید.
          </p>
          <a
            href={appVersion?.apkUrl || "/downloads/petronabz-latest.apk"}
            download="petronabz-latest.apk"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
          >
            <Download className="w-4 h-4" />
            دانلود فایل نصبی اندروید (APK امضاشده)
          </a>
        </div>
      </div>
    </div>
  );
}
