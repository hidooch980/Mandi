"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme() {
    const nextDark = !dark;
    document.documentElement.classList.toggle("dark", nextDark);
    document.documentElement.style.colorScheme = nextDark ? "dark" : "light";
    try {
      localStorage.setItem("petronabz_theme", nextDark ? "dark" : "light");
    } catch {
      // ignore storage quota errors
    }
    setDark(nextDark);
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        title={dark ? "تغییر به حالت روز" : "تغییر به حالت شب"}
        aria-label={dark ? "حالت روز" : "حالت شب"}
        className="p-2 rounded-lg bg-slate-900 text-amber-300 hover:bg-slate-800 transition cursor-pointer"
      >
        {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 px-3 py-2 flex items-center justify-between text-xs text-slate-200 transition cursor-pointer"
    >
      <span className="flex items-center gap-2">
        {dark ? (
          <Sun className="w-4 h-4 text-amber-400" />
        ) : (
          <Moon className="w-4 h-4 text-sky-400" />
        )}
        <span>{dark ? "حالت شب فعال" : "حالت روز فعال"}</span>
      </span>
      <span className="text-[11px] font-bold text-emerald-400">
        {dark ? "تغییر به روز" : "تغییر به شب"}
      </span>
    </button>
  );
}
