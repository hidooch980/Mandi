"use client";

import { Printer } from "lucide-react";

export function PrintInvoiceButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 shadow cursor-pointer"
    >
      <Printer className="w-4 h-4" />
      چاپ / ذخیره فایل PDF
    </button>
  );
}
