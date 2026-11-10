import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Compass,
  Download,
  Fuel,
  Laptop,
  ShieldCheck,
  Smartphone,
  TrendingUp,
} from "lucide-react";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import { formatJalaliDateTime, formatNumberFa, formatUsd } from "@/lib/jalali";
import { getDieselDiscoverySummary, listProductsWithPricing } from "@/lib/services";
import { getMarketConfig } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  const config = await getMarketConfig();
  const [dieselSummary, products] = await Promise.all([
    getDieselDiscoverySummary(config),
    listProductsWithPricing(true),
  ]);

  const dashboardHref = user
    ? isStaffRole(user.role)
      ? "/dashboard"
      : "/portal"
    : "/login";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-amber-500 flex items-center justify-center shadow-lg">
              <Fuel className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h1 className="font-extrabold text-base sm:text-lg text-white">
                پترونبض
              </h1>
              <p className="text-[11px] text-slate-400">
                خرید و فروش بنزین و گازوئیل • استعلام تلفنی و واتساپ گازوئیل
              </p>
            </div>
          </div>

          <Link
            href={dashboardHref}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-2 transition"
          >
            <span>{user ? "ورود به پنل" : "ورود به سامانه"}</span>
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-12 w-full">
        <div className="grid lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
              <Smartphone className="w-4 h-4" />
              <span>دسترسی آنلاین ۲۴ ساعته روی اندروید، آیفون، ویندوز و مک</span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight">
              سامانه هوشمند{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-l from-amber-400 to-emerald-400">
                خرید و فروش بنزین و گازوئیل
              </span>{" "}
              با استعلام از دلال‌ها و واتساپ
            </h2>

            <p className="text-slate-300 text-sm sm:text-base leading-7 max-w-2xl">
              استعلام تلفنی دلال‌ها و قیمت‌های کانال واتساپ گازوئیل را ثبت و
              مقایسه کنید، خرید و فروش بشکه‌ای گازوئیل (مثلاً خرید ۳۷ میلیون و فروش
              ۳۷.۵ میلیون) و بنزین ۷۰ لیتری (خرید ۸ میلیون و فروش ۹ میلیون) را با
              محاسبه دقیق سود و موجودی انبار ثبت نمایید.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href={dashboardHref}
                className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition"
              >
                <Compass className="w-4 h-4" />
                <span>{user ? "ادامه در پنل کاربری" : "ورود به پنل مدیریت"}</span>
              </Link>
              <a
                href="/downloads/petronabz-latest.apk"
                download="petronabz-latest.apk"
                className="px-5 py-3 rounded-xl bg-slate-900 border border-slate-700 hover:border-amber-400 text-amber-300 font-bold text-sm flex items-center gap-2 transition"
              >
                <Download className="w-4 h-4" />
                <span>دانلود APK اندروید (امضاشده)</span>
              </a>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>استعلام از دلال و واتساپ</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>بنزین ۷۰ لیتری و گازوئیل بشکه‌ای</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>نصب وب‌اپ آیفون و اپلیکیشن اندروید</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  <span className="font-bold text-sm text-white">
                    تابلوی نرخ روز بنزین و گازوئیل
                  </span>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">
                  زنده
                </span>
              </div>

              <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-emerald-400">
                    گازوئیل بشکه‌ای ۲۲۰ لیتری ({formatNumberFa(dieselSummary.quoteCount)} استعلام)
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-slate-400">نرخ فروش بشکه</div>
                    <div className="text-base font-extrabold text-white tabular-nums mt-0.5">
                      {formatNumberFa(dieselSummary.publishedSellPerBarrelToman)} ت
                    </div>
                    <div className="text-[11px] text-slate-400 tabular-nums">
                      {formatUsd(dieselSummary.suggestedSellPerBarrelUsd)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">بهترین استعلام خرید</div>
                    <div className="text-base font-bold text-emerald-400 tabular-nums mt-0.5">
                      {dieselSummary.bestBuy
                        ? `${formatNumberFa(dieselSummary.bestBuy.landedPerBarrelToman)} ت`
                        : "—"}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {dieselSummary.bestBuy?.sourceName ?? "بدون استعلام"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-amber-300">
                    بنزین ۷۰ لیتری
                  </span>
                  <span className="text-[11px] text-slate-400">واحد ۷۰ لیتر</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <div className="text-slate-400">نرخ فروش هر ۷۰ لیتری</div>
                    <div className="text-base font-extrabold text-white tabular-nums mt-0.5">
                      {formatNumberFa(config.publishedGasolineBarrelToman)} ت
                    </div>
                  </div>
                  <div className="text-left tabular-nums">
                    <div className="text-slate-400">معادل هر لیتر</div>
                    <div className="text-sm font-bold text-amber-300 mt-0.5">
                      {formatNumberFa(Math.round(config.publishedGasolineBarrelToman / 70))} تومان
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                <span>کالاهای انبار: {formatNumberFa(products.length)} مورد فعال</span>
                <span>بروزرسانی: {formatJalaliDateTime(new Date())}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 w-full">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: Compass,
              title: "استعلام از دلال و واتساپ",
              desc: "ثبت سریع قیمت‌های تلفنی دلال‌ها و کپی پیام کانال‌های واتساپ برای کشف ارزان‌ترین فروشنده گازوئیل.",
            },
            {
              icon: Fuel,
              title: "خرید و فروش بنزین و گازوئیل",
              desc: "ثبت خریدهای ورودی (مثل ۳۷م گازوئیل / ۸م بنزین ۷۰ لیتری) و فروش‌های روز با سود دقیق.",
            },
            {
              icon: ShieldCheck,
              title: "بدون ثبت‌نام مشتری",
              desc: "محیط اختصاصی مدیر و همکار فروش با ذخیره امن تمام سوابق معاملات و مشتریان در دیتابیس سامانه.",
            },
            {
              icon: Laptop,
              title: "اپلیکیشن اندروید و وب‌اپ آیفون",
              desc: "نسخه APK اختصاصی و قابل بروزرسانی برای اندروید، وب‌اپ برای Safari آیفون و نصب دسکتاپ روی کامپیوتر.",
            },
          ].map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 space-y-2.5"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-amber-400">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white text-sm">{feat.title}</h3>
                <p className="text-xs text-slate-400 leading-6">{feat.desc}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
