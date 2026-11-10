"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Boxes,
  Compass,
  FileText,
  Fuel,
  LogOut,
  MessageSquare,
  Settings,
  ShoppingBag,
  Users,
} from "lucide-react";
import { formatNumberFa } from "@/lib/jalali";
import type { PublicUser } from "@/lib/types";

interface AppShellProps {
  user: PublicUser;
  usdToToman?: number;
  children: React.ReactNode;
}

export function AppShell({ user, usdToToman, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isStaff = user.role === "ADMIN" || user.role === "SALES";

  const staffNav = [
    { href: "/dashboard", label: "داشبورد", icon: BarChart3 },
    { href: "/discovery", label: "کشف قیمت گازوئیل", icon: Compass },
    { href: "/sms", label: "پیامک ساعتی", icon: MessageSquare },
    { href: "/orders", label: "خرید و فروش", icon: FileText },
    { href: "/inventory", label: "انبار بنزین و گازوئیل", icon: Boxes },
    { href: "/customers", label: "فروشندگان و خریداران", icon: Users },
    { href: "/settings", label: "تنظیمات", icon: Settings },
  ];

  const customerNav = [
    { href: "/portal", label: "سفارش بنزین و گازوئیل", icon: ShoppingBag },
  ];

  const navItems = isStaff ? staffNav : customerNav;
  const mobileNav = navItems.slice(0, 5);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-100 text-slate-900">
      <aside className="no-print hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:right-0 bg-slate-950 text-slate-100 border-l border-slate-800 z-30">
        <div className="p-5 border-b border-slate-800/80 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-amber-500 flex items-center justify-center shadow-lg">
            <Fuel className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <div className="font-extrabold text-base tracking-tight text-white">
              پترونبض
            </div>
            <div className="text-[11px] text-emerald-400">
              خرید و فروش بنزین و گازوئیل
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                  active
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                    : "text-slate-300 hover:bg-slate-900 hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800/80 space-y-3">
          {usdToToman ? (
            <div className="rounded-xl bg-slate-900 px-3 py-2 flex items-center justify-between text-xs">
              <span className="text-slate-400">نرخ دلار مبنا</span>
              <span className="font-bold text-amber-400 tabular-nums">
                {formatNumberFa(usdToToman)} ت
              </span>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {user.name}
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                {user.role === "ADMIN"
                  ? "مدیر کل"
                  : user.role === "SALES"
                    ? "کارشناس خرید و فروش"
                    : user.companyName || "خریدار"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="خروج از حساب"
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 md:mr-64 flex flex-col min-h-screen pb-20 md:pb-0">
        <header className="no-print md:hidden sticky top-0 z-20 bg-slate-950 text-white px-4 py-3 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-amber-500 flex items-center justify-center">
              <Fuel className="w-4 h-4 text-slate-950" />
            </div>
            <div>
              <div className="font-bold text-sm leading-tight">پترونبض</div>
              <div className="text-[11px] text-slate-400">{user.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {usdToToman ? (
              <span className="text-[11px] bg-slate-800 text-amber-300 px-2 py-1 rounded-lg tabular-nums">
                دلار: {formatNumberFa(usdToToman)}
              </span>
            ) : null}
            <button
              type="button"
              onClick={handleLogout}
              aria-label="خروج"
              className="p-2 rounded-lg bg-slate-900 text-slate-300"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      <nav className="no-print md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 safe-bottom shadow-[0_-4px_20px_rgba(15,23,42,0.08)]">
        <div className="grid grid-cols-5 max-w-lg mx-auto">
          {mobileNav.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center py-2 px-1 text-[10px] font-medium ${
                  active ? "text-emerald-700 font-bold" : "text-slate-500"
                }`}
              >
                <Icon
                  className={`w-5 h-5 mb-0.5 ${active ? "text-emerald-600" : ""}`}
                />
                <span className="truncate max-w-full">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
