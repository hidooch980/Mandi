"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  DatabaseBackup,
  Download,
  Globe,
  Laptop,
  Settings,
  Smartphone,
  Wifi,
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
  const [lanUrls, setLanUrls] = useState<string[]>([]);
  const [copiedUrl, setCopiedUrl] = useState("");
  const [appVersion, setAppVersion] = useState<{
    versionCode: number;
    versionName: string;
    apkAvailable: boolean;
    apkUrl: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/network-info")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && Array.isArray(d.urls)) {
          setLanUrls(d.urls);
        }
      })
      .catch(() => {});
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

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
    setCopiedUrl(text);
    setTimeout(() => setCopiedUrl(""), 2000);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-slate-700" />
          <span>تنظیمات، پشتیبان‌گیری و اجرای رایگان بدون هاست و دامین</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          تنظیم سود و نرخ‌ها، دانلود فایل بکاپ دیتابیس و دسترسی رایگان روی موبایل و لپ‌تاپ
        </p>
      </div>

      {savedMsg && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3.5 font-semibold">
          {savedMsg}
        </div>
      )}

      {/* Zero-Cost Hosting Guide */}
      <div className="rounded-2xl bg-slate-950 text-white p-5 sm:p-6 space-y-4 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h2 className="font-extrabold text-base text-emerald-400 flex items-center gap-2">
              <Wifi className="w-5 h-5" />
              <span>بالا آوردن برنامه به‌صورت ۱۰۰٪ رایگان (بدون خرید هاست و دامین)</span>
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              دیتابیس و برنامه روی سیستم خودتان می‌ماند و تمام گوشی‌ها (اندروید و آیفون) و لپ‌تاپ‌ها رایگان وصل می‌شوند.
            </p>
          </div>
          <a
            href="/api/backup"
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 shrink-0"
          >
            <DatabaseBackup className="w-4 h-4" />
            دانلود بکاپ کامل اطلاعات
          </a>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-2.5">
            <div className="font-bold text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <span>روش ۱ (رایگان روی وای‌فای محل کار / منزل):</span>
            </div>
            <p className="text-slate-300 leading-6">
              فایل <code className="text-amber-300">start-local.bat</code> را در پوشه پروژه
              اجرا کنید تا برنامه روی تمام دستگاه‌های وای‌فای باز شود. سپس در گوشی
              اندروید یا آیفون آدرس زیر را باز کنید:
            </p>
            {lanUrls.length > 0 ? (
              <div className="space-y-1.5">
                {lanUrls.map((u) => (
                  <div
                    key={u}
                    className="flex items-center justify-between gap-2 rounded-lg bg-slate-950 border border-slate-800 px-3 py-2"
                  >
                    <span dir="ltr" className="font-mono text-emerald-300 font-bold">
                      {u}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyText(u)}
                      className="text-slate-300 hover:text-white inline-flex items-center gap-1 cursor-pointer"
                    >
                      {copiedUrl === u ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>کپی شد</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>کپی</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-400">
                آدرس شبکه محلی (مثلاً <code dir="ltr">http://192.168.1.5:3000</code>) هنگام اجرا نمایش داده می‌شود.
              </div>
            )}
          </div>

          <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-2.5">
            <div className="font-bold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-sky-400" />
              <span>روش ۲ (دسترسی از بیرون با اینترنت موبایل — کاملاً رایگان و HTTPS):</span>
            </div>
            <p className="text-slate-300 leading-6">
              برای دسترسی از هر شهری بدون خرید هاست و دامین، ابزار رایگان{" "}
              <strong>Cloudflare Tunnel</strong> را با یک دستور اجرا کنید تا یک آدرس
              امن <code dir="ltr" className="text-sky-300">https://...trycloudflare.com</code>{" "}
              رایگان بسازد (و روی آیفون و اندروید هم به‌عنوان اپ نصب شود):
            </p>
            <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-950 border border-slate-800 px-3 py-2">
              <code dir="ltr" className="font-mono text-sky-300 text-[11px] truncate">
                cloudflared tunnel --url http://localhost:3000
              </code>
              <button
                type="button"
                onClick={() =>
                  copyText("cloudflared tunnel --url http://localhost:3000")
                }
                className="text-slate-300 hover:text-white inline-flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>کپی</span>
              </button>
            </div>
          </div>
        </div>
      </div>

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
