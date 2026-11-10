"use client";

import { useEffect, useState } from "react";
import {
  DatabaseBackup,
  Download,
  KeyRound,
  Laptop,
  Settings,
  Shield,
  Smartphone,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { SAMPLE_IMPORT_CSV } from "@/lib/csv-importer";
import type { MarketConfig, PublicUser, UserRole } from "@/lib/types";

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "مدیر کل",
  SALES: "همکار فروش و استعلام",
  CUSTOMER: "مشتری / پرتال خرید",
};

export function SettingsClient({
  initialConfig,
  currentUser,
  initialUsers,
}: {
  initialConfig: MarketConfig;
  currentUser: PublicUser;
  initialUsers: PublicUser[];
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
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  // Admin Account Management State
  const [users, setUsers] = useState<PublicUser[]>(initialUsers);
  const [uName, setUName] = useState("");
  const [uPhone, setUPhone] = useState("");
  const [uPassword, setUPassword] = useState("");
  const [uRole, setURole] = useState<UserRole>("SALES");
  const [uCompany, setUCompany] = useState("");
  const [uCity, setUCity] = useState("تهران");
  const [userBusy, setUserBusy] = useState(false);
  const [userMsg, setUserMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
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

      {currentUser.role === "ADMIN" && (
        <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <h2 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-600" />
              <span>مدیریت کاربران و افزودن اکانت جدید</span>
            </h2>
            <span className="text-[11px] text-slate-500">
              {users.length} اکانت ثبت‌شده در سامانه
            </span>
          </div>

          {userMsg && (
            <div
              className={`rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${
                userMsg.type === "ok"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border-rose-200 text-rose-700"
              }`}
            >
              {userMsg.text}
            </div>
          )}

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setUserBusy(true);
              setUserMsg(null);
              try {
                const res = await fetch("/api/admin/users", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name: uName,
                    phone: uPhone,
                    password: uPassword,
                    role: uRole,
                    companyName: uCompany,
                    city: uCity,
                  }),
                });
                const data = await res.json();
                if (!res.ok || !data.ok) {
                  setUserMsg({
                    type: "err",
                    text: data.error || "خطا در ایجاد اکانت",
                  });
                  return;
                }
                setUsers(data.users);
                setUName("");
                setUPhone("");
                setUPassword("");
                setUCompany("");
                setUserMsg({
                  type: "ok",
                  text: "اکانت جدید با موفقیت ساخته شد و الان با شماره و رمز قابل ورود است.",
                });
              } finally {
                setUserBusy(false);
              }
            }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs rounded-xl bg-slate-50 border border-slate-200 p-4"
          >
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                نام و نام خانوادگی *
              </label>
              <input
                required
                value={uName}
                onChange={(e) => setUName(e.target.value)}
                placeholder="مثلاً: رضا محمدی"
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                شماره موبایل ورود *
              </label>
              <input
                required
                dir="ltr"
                value={uPhone}
                onChange={(e) => setUPhone(e.target.value)}
                placeholder="09123456789"
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                رمز عبور ورود (حداقل ۶ رقم) *
              </label>
              <input
                required
                type="password"
                dir="ltr"
                value={uPassword}
                onChange={(e) => setUPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                سطح دسترسی
              </label>
              <select
                value={uRole}
                onChange={(e) => setURole(e.target.value as UserRole)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              >
                <option value="SALES">همکار فروش و استعلام</option>
                <option value="ADMIN">مدیر کل (دسترسی کامل)</option>
                <option value="CUSTOMER">مشتری (پرتال ثبت سفارش)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                شرکت / عنوان (اختیاری)
              </label>
              <input
                value={uCompany}
                onChange={(e) => setUCompany(e.target.value)}
                placeholder="نام مجموعه"
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block font-semibold text-slate-700 mb-1">
                  شهر
                </label>
                <input
                  value={uCity}
                  onChange={(e) => setUCity(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <button
                type="submit"
                disabled={userBusy}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs inline-flex items-center gap-1.5 shrink-0 cursor-pointer h-[38px]"
              >
                <UserPlus className="w-4 h-4" />
                <span>{userBusy ? "در حال ثبت..." : "افزودن اکانت"}</span>
              </button>
            </div>
          </form>

          <div className="space-y-2">
            {users.map((u) => {
              const isSelf = u.id === currentUser.id;
              return (
                <div
                  key={u.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <Shield
                      className={`w-4 h-4 shrink-0 ${
                        u.role === "ADMIN"
                          ? "text-emerald-600"
                          : u.role === "SALES"
                            ? "text-amber-600"
                            : "text-sky-600"
                      }`}
                    />
                    <span className="font-bold text-slate-900">{u.name}</span>
                    {isSelf && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        شما
                      </span>
                    )}
                    <span
                      dir="ltr"
                      className="text-slate-600 font-mono tabular-nums"
                    >
                      {u.phone}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.role === "ADMIN"
                          ? "bg-emerald-100 text-emerald-800"
                          : u.role === "SALES"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-sky-100 text-sky-800"
                      }`}
                    >
                      {ROLE_LABELS[u.role]}
                    </span>
                    {!u.isActive && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                        غیرفعال
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={userBusy}
                      onClick={async () => {
                        const pwd = window.prompt(
                          `رمز عبور جدید برای «${u.name}» (حداقل ۶ کاراکتر):`
                        );
                        if (!pwd || pwd.trim().length < 6) return;
                        setUserBusy(true);
                        setUserMsg(null);
                        try {
                          const res = await fetch(`/api/admin/users/${u.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ newPassword: pwd.trim() }),
                          });
                          const data = await res.json();
                          if (res.ok && data.ok) {
                            setUsers(data.users);
                            setUserMsg({
                              type: "ok",
                              text: `رمز عبور «${u.name}» تغییر یافت.`,
                            });
                          } else {
                            setUserMsg({
                              type: "err",
                              text: data.error || "خطا در تغییر رمز",
                            });
                          }
                        } finally {
                          setUserBusy(false);
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer"
                    >
                      تغییر رمز
                    </button>

                    {!isSelf && (
                      <>
                        <button
                          type="button"
                          disabled={userBusy}
                          onClick={async () => {
                            setUserBusy(true);
                            setUserMsg(null);
                            try {
                              const res = await fetch(`/api/admin/users/${u.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ isActive: !u.isActive }),
                              });
                              const data = await res.json();
                              if (res.ok && data.ok) setUsers(data.users);
                              else
                                setUserMsg({
                                  type: "err",
                                  text: data.error || "خطا در تغییر وضعیت",
                                });
                            } finally {
                              setUserBusy(false);
                            }
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer"
                        >
                          {u.isActive ? "مسدود" : "فعال‌سازی"}
                        </button>
                        <button
                          type="button"
                          disabled={userBusy}
                          onClick={async () => {
                            if (
                              !window.confirm(
                                `اکانت «${u.name}» (${u.phone}) حذف شود؟`
                              )
                            ) {
                              return;
                            }
                            setUserBusy(true);
                            setUserMsg(null);
                            try {
                              const res = await fetch(`/api/admin/users/${u.id}`, {
                                method: "DELETE",
                              });
                              const data = await res.json();
                              if (res.ok && data.ok) {
                                setUsers(data.users);
                                setUserMsg({
                                  type: "ok",
                                  text: `اکانت «${u.name}» حذف شد.`,
                                });
                              } else {
                                setUserMsg({
                                  type: "err",
                                  text: data.error || "خطا در حذف اکانت",
                                });
                              }
                            } finally {
                              setUserBusy(false);
                            }
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-[11px] font-semibold text-rose-700 cursor-pointer"
                        >
                          حذف
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {currentUser.role === "ADMIN" && (
        <div className="rounded-2xl bg-rose-50/70 border border-rose-200 p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-rose-900 text-sm flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>پاکسازی کامل و تبدیل به دیتابیس خام</span>
            </h2>
            <p className="text-xs text-rose-800/90 mt-1 leading-5">
              تمام معاملات خرید و فروش، استعلام‌ها، تاریخچه قیمت، پیامک‌ها، لیست فروشندگان و خریداران نمونه پاک شده و موجودی انبار صفر می‌شود. (حساب مدیر و رمز عبور فعلی شما حفظ می‌ماند.)
            </p>
          </div>
          <button
            type="button"
            disabled={resetBusy}
            onClick={async () => {
              const confirmed = window.confirm(
                "آیا مطمئن هستید؟ تمام داده‌های فعلی (معاملات، استعلام‌ها، دلال‌ها، خریداران و موجودی انبار) پاک شده و دیتابیس کاملاً خام می‌شود."
              );
              if (!confirmed) return;
              setResetBusy(true);
              setResetMsg(null);
              try {
                const res = await fetch("/api/admin/reset-clean", {
                  method: "POST",
                });
                const data = await res.json();
                if (!res.ok || !data.ok) {
                  setResetMsg({
                    type: "err",
                    text: data.error || "خطا در پاکسازی دیتابیس",
                  });
                } else {
                  setResetMsg({
                    type: "ok",
                    text: data.message || "دیتابیس با موفقیت خام شد.",
                  });
                  const [cfgRes, usersRes] = await Promise.all([
                    fetch("/api/config").then((r) => r.json()),
                    fetch("/api/admin/users").then((r) => r.json()),
                  ]);
                  if (cfgRes.ok && cfgRes.config) {
                    setCfg(cfgRes.config);
                  }
                  if (usersRes.ok && usersRes.users) {
                    setUsers(usersRes.users);
                  }
                }
              } finally {
                setResetBusy(false);
              }
            }}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer self-start sm:self-auto"
          >
            <Trash2 className="w-4 h-4" />
            <span>{resetBusy ? "در حال پاکسازی..." : "پاکسازی کامل و خام‌سازی"}</span>
          </button>
        </div>

        {resetMsg && (
          <div
            className={`rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${
              resetMsg.type === "ok"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-white border-rose-300 text-rose-700"
            }`}
          >
            {resetMsg.text}
          </div>
        )}
      </div>
      )}

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
