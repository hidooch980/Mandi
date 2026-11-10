"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Fuel, KeyRound, Shield } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submitLogin(idVal: string, passVal: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: idVal, password: passVal }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        user?: { role: string };
      };
      if (!res.ok || !data.ok) {
        setError(data.error || "شماره موبایل یا رمز عبور صحیح نیست.");
        return;
      }
      const target =
        data.user?.role === "ADMIN" || data.user?.role === "SALES"
          ? "/dashboard"
          : "/portal";
      router.push(target);
      router.refresh();
    } catch {
      setError("ارتباط با سرور برقرار نشد.");
    } finally {
      setLoading(false);
    }
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitLogin(identifier, password);
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md space-y-5">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
          >
            <ArrowRight className="w-4 h-4" />
            بازگشت به صفحه اصلی
          </Link>
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Fuel className="w-4 h-4 text-amber-400" />
            <span>پترونبض</span>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-2xl space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h1 className="text-lg font-extrabold text-slate-900">
              ورود به سامانه خرید و فروش بنزین و گازوئیل
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              ثبت‌نام عمومی غیرفعال است؛ با حساب مجاز وارد شوید.
            </p>
          </div>

          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                شماره موبایل یا ایمیل
              </label>
              <input
                required
                dir="ltr"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="09120000001"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-left focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                رمز عبور
              </label>
              <input
                required
                type="password"
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-left focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              <span>{loading ? "در حال ورود..." : "ورود به سامانه"}</span>
            </button>
          </form>

          {/* One-Click Demo Accounts for Staff (hidden when NEXT_PUBLIC_HIDE_DEMO=1) */}
          {process.env.NEXT_PUBLIC_HIDE_DEMO !== "1" && (
            <div className="pt-3 border-t border-slate-200 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Shield className="w-4 h-4 text-emerald-600" />
                <span>ورود سریع نمونه (مدیریت و کارشناس):</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => submitLogin("09120000001", "admin1234")}
                  className="p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-right transition cursor-pointer"
                >
                  <div className="text-xs font-bold text-emerald-900">
                    ورود مدیر سیستم
                  </div>
                  <div className="text-[11px] text-emerald-700 tabular-nums" dir="ltr">
                    09120000001 / admin1234
                  </div>
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => submitLogin("09120000002", "sales1234")}
                  className="p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-right transition cursor-pointer"
                >
                  <div className="text-xs font-bold text-amber-900">
                    ورود کارشناس خرید و فروش
                  </div>
                  <div className="text-[11px] text-amber-700 tabular-nums" dir="ltr">
                    09120000002 / sales1234
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
