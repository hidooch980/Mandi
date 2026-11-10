"use client";

import { useState } from "react";
import {
  Activity,
  Award,
  CheckCircle2,
  Compass,
  MessageSquareText,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
} from "lucide-react";
import { PriceHistoryChart, SourceBreakdownChart } from "@/components/Charts";
import { SAMPLE_IMPORT_CSV } from "@/lib/csv-importer";
import { formatJalaliDateTime, formatNumberFa, formatUsd } from "@/lib/jalali";
import { SOURCE_TYPE_LABELS } from "@/lib/pricing-engine";
import {
  normalizeIranPhone,
  parseSmartMessage,
  type ParsedSmartMessage,
} from "@/lib/whatsapp-parser";
import type {
  DieselDiscoverySummary,
  MarketConfig,
  PriceCurrency,
  PriceHistoryPoint,
  PriceSource,
  PriceSourceType,
  PriceUnit,
} from "@/lib/types";

interface DiscoveryState {
  config: MarketConfig;
  sources: PriceSource[];
  summary: DieselDiscoverySummary;
  history: PriceHistoryPoint[];
}

export function DiscoveryClient({
  initialState,
}: {
  initialState: DiscoveryState;
}) {
  const [state, setState] = useState<DiscoveryState>(initialState);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  // Market Config form state
  const [usdToToman, setUsdToToman] = useState(state.config.usdToToman);
  const [aedToToman, setAedToToman] = useState(state.config.aedToToman);
  const [dieselDensity, setDieselDensity] = useState(state.config.dieselDensity);
  const [emptyBarrelCost, setEmptyBarrelCost] = useState(
    state.config.emptyBarrelCostToman
  );
  const [fixedProfit, setFixedProfit] = useState(
    state.config.fixedProfitPerBarrelToman
  );
  const [targetMargin, setTargetMargin] = useState(state.config.targetMarginPercent);
  const [customPublishPrice, setCustomPublishPrice] = useState<string>("");

  // Modals
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // New Quote form (defaults tailored to broker phone / WhatsApp barrel quotes)
  const [quoteMode, setQuoteMode] = useState<"EXISTING" | "NEW">("EXISTING");
  const [qSourceId, setQSourceId] = useState<number>(state.sources[0]?.id ?? 1);
  const [qNewName, setQNewName] = useState("");
  const [qNewType, setQNewType] = useState<PriceSourceType>("BROKER_PHONE");
  const [qNewContact, setQNewContact] = useState("");
  const [whatsappPaste, setWhatsappPaste] = useState("");
  const [parsedPreview, setParsedPreview] = useState<ParsedSmartMessage | null>(
    null
  );
  const [matchedSourceName, setMatchedSourceName] = useState<string>("");
  const [priceInMillions, setPriceInMillions] = useState(false);
  const [qRawPrice, setQRawPrice] = useState<string>("");
  const [qCurrency, setQCurrency] = useState<PriceCurrency>("TOMAN");
  const [qUnit, setQUnit] = useState<PriceUnit>("BARREL");
  const [qIncludesBarrel, setQIncludesBarrel] = useState(true);
  const [qFreight, setQFreight] = useState<string>("0");
  const [qAvailBarrels, setQAvailBarrels] = useState<string>("10");
  const [qNotes, setQNotes] = useState<string>("");

  // New Broker / Channel form
  const [sName, setSName] = useState("");
  const [sType, setSType] = useState<PriceSourceType>("BROKER_PHONE");
  const [sCity, setSCity] = useState("واتساپ / تلفنی");
  const [sContact, setSContact] = useState("");
  const [sApiUrl, setSApiUrl] = useState("");
  const [sWeight, setSWeight] = useState("85");
  const [sFreight, setSFreight] = useState("0");

  // CSV Import
  const [csvText, setCsvText] = useState(SAMPLE_IMPORT_CSV);

  const summary = state.summary;
  const historyPoints = state.history;

  async function refreshDiscovery() {
    const res = await fetch("/api/discovery");
    const data = await res.json();
    if (data.ok) {
      setState({
        config: data.config,
        sources: data.sources,
        summary: data.summary,
        history: data.history,
      });
    }
  }

  function extractSmartSms(text: string) {
    if (!text.trim()) {
      setParsedPreview(null);
      setMatchedSourceName("");
      return;
    }
    const parsed = parseSmartMessage(text);
    setParsedPreview(parsed);

    if (parsed.priceToman) {
      setPriceInMillions(false);
      setQCurrency(parsed.currency);
      setQUnit(parsed.unit);
      setQRawPrice(String(parsed.priceToman));
    }
    if (parsed.availableBarrels) {
      setQAvailBarrels(String(parsed.availableBarrels));
    }

    // Try matching existing broker/source by normalized phone number or name
    const existingByPhone = state.sources.find((s) => {
      const srcPhone = normalizeIranPhone(s.contactInfo);
      return srcPhone.length >= 10 && parsed.phones.includes(srcPhone);
    });
    const existingByName =
      !existingByPhone && parsed.suggestedSourceName
        ? state.sources.find((s) =>
            s.name.includes(parsed.suggestedSourceName)
          )
        : undefined;
    const matched = existingByPhone ?? existingByName;

    if (matched) {
      setQuoteMode("EXISTING");
      setQSourceId(matched.id);
      setMatchedSourceName(matched.name);
    } else {
      setMatchedSourceName("");
      if (parsed.suggestedSourceName || parsed.phone) {
        setQuoteMode("NEW");
        if (parsed.suggestedSourceName) {
          setQNewName(parsed.suggestedSourceName);
        } else if (parsed.phone) {
          setQNewName(`شماره ${parsed.phone}`);
        }
        setQNewType(parsed.sourceType);
      }
      if (parsed.phone) {
        setQNewContact(parsed.phone);
      }
    }

    setQNotes(parsed.notes);
  }

  async function handlePasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setWhatsappPaste(text);
        extractSmartSms(text);
      }
    } catch {
      // Clipboard permission may require manual Ctrl+V in textarea
    }
  }

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usdToToman: Number(usdToToman),
          aedToToman: Number(aedToToman),
          dieselDensity: Number(dieselDensity),
          emptyBarrelCostToman: Number(emptyBarrelCost),
          fixedProfitPerBarrelToman: Number(fixedProfit),
          targetMarginPercent: Number(targetMargin),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFeedback({ type: "err", text: data.error || "خطا در ذخیره تنظیمات" });
      } else {
        await refreshDiscovery();
        setFeedback({
          type: "ok",
          text: "پارامترهای سود و تبدیل قیمت ذخیره و تمام استعلام‌های گازوئیل بروزرسانی شدند.",
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handlePublishPrice(useCustom: boolean) {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/discovery/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customBarrelPriceToman: useCustom ? Number(customPublishPrice) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFeedback({ type: "err", text: data.error || "خطا در انتشار قیمت گازوئیل" });
      } else {
        setState({
          config: data.state.config,
          sources: data.state.sources,
          summary: data.state.summary,
          history: data.state.history,
        });
        setCustomPublishPrice("");
        setFeedback({
          type: "ok",
          text: `نرخ فروش روز گازوئیل با مبلغ ${formatNumberFa(
            data.publishedPrice
          )} تومان برای هر بشکه منتشر شد.`,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleAddQuote(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const numericInput = Number(qRawPrice);
      const finalRawPrice =
        priceInMillions && qCurrency === "TOMAN" && qUnit === "BARREL"
          ? Math.round(numericInput * 1_000_000)
          : numericInput;

      const res = await fetch("/api/discovery/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: quoteMode === "EXISTING" ? Number(qSourceId) : undefined,
          newSourceName: quoteMode === "NEW" ? qNewName : undefined,
          newSourceType: quoteMode === "NEW" ? qNewType : undefined,
          newSourceContact: quoteMode === "NEW" ? qNewContact : undefined,
          rawPrice: finalRawPrice,
          currency: qCurrency,
          unit: qUnit,
          includesBarrel: qIncludesBarrel,
          freightPerBarrelToman: Number(qFreight),
          availableBarrels: Number(qAvailBarrels),
          notes: qNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFeedback({ type: "err", text: data.error || "خطا در ثبت استعلام" });
      } else {
        setState({
          config: data.state.config,
          sources: data.state.sources,
          summary: data.state.summary,
          history: data.state.history,
        });
        setShowQuoteModal(false);
        setQRawPrice("");
        setQNotes("");
        setQNewName("");
        setQNewContact("");
        setWhatsappPaste("");
        setParsedPreview(null);
        setMatchedSourceName("");
        setFeedback({
          type: "ok",
          text: "استعلام تلفنی / واتساپ جدید ثبت و با سایر دلال‌ها مقایسه شد.",
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteQuote(quoteId: number) {
    setBusy(true);
    try {
      const res = await fetch(`/api/discovery/quote/${quoteId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.ok) {
        setState({
          config: data.state.config,
          sources: data.state.sources,
          summary: data.state.summary,
          history: data.state.history,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateSource(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: sName,
          type: sType,
          city: sCity,
          contactInfo: sContact,
          apiUrl: sApiUrl,
          confidenceWeight: Number(sWeight),
          defaultFreightPerBarrelToman: Number(sFreight),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFeedback({ type: "err", text: data.error || "خطا در افزودن دلال/کانال" });
      } else {
        setQSourceId(data.sourceId);
        await refreshDiscovery();
        setShowSourceModal(false);
        setSName("");
        setSApiUrl("");
        setSContact("");
        setFeedback({
          type: "ok",
          text: "دلال / کانال واتساپ جدید به لیست استعلام گازوئیل اضافه شد.",
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleSource(src: PriceSource) {
    setBusy(true);
    try {
      await fetch(`/api/sources/${src.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !src.isActive }),
      });
      await refreshDiscovery();
    } finally {
      setBusy(false);
    }
  }

  async function handleImportCsv(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/prices/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFeedback({ type: "err", text: data.error || "خطا در ایمپورت CSV" });
      } else {
        setState({
          config: data.state.config,
          sources: data.state.sources,
          summary: data.state.summary,
          history: data.state.history,
        });
        setShowImportModal(false);
        setFeedback({
          type: "ok",
          text: `${formatNumberFa(data.importedCount)} استعلام گازوئیل وارد و مقایسه شد.`,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSyncFeeds(mode: "LIVE" | "SIMULATE") {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/prices/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFeedback({ type: "err", text: data.error || "خطا در بروزرسانی" });
      } else {
        setState({
          config: data.state.config,
          sources: data.state.sources,
          summary: data.state.summary,
          history: data.state.history,
        });
        setFeedback({
          type: "ok",
          text: (data.logs as string[])?.join(" | ") || "بروزرسانی انجام شد.",
        });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Compass className="w-6 h-6 text-emerald-600" />
            <span>کشف قیمت گازوئیل (استعلام تلفنی و کانال واتساپ)</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            مقایسه لحظه‌ای قیمت دلال‌ها (تماس تلفنی) و کانال‌های واتساپ، انتخاب ارزان‌ترین فروشنده و تعیین نرخ فروش بشکه
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowQuoteModal(true)}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            ثبت استعلام دلال / واتساپ
          </button>
          <button
            type="button"
            onClick={() => setShowSourceModal(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            افزودن دلال / کانال واتساپ
          </button>
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-4 h-4 text-sky-600" />
            ایمپورت اکسل / CSV
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => handleSyncFeeds("SIMULATE")}
            className="px-3.5 py-2 rounded-xl bg-amber-100 border border-amber-300 hover:bg-amber-200 text-amber-900 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${busy ? "animate-spin" : ""}`} />
            شبیه‌سازی نوسان بازار
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-xl p-3.5 text-xs sm:text-sm font-medium border ${
            feedback.type === "ok"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Market Normalization & Target Profit Parameters */}
      <form
        onSubmit={handleSaveConfig}
        className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-800">
            <SlidersHorizontal className="w-4 h-4 text-amber-600" />
            <span>
              تنظیمات سود پیشنهادی هر بشکه و نرخ تبدیل ({formatNumberFa(state.config.defaultBarrelLiters)} لیتری)
            </span>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
          >
            بروزرسانی فرمول
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div>
            <label className="block text-slate-500 mb-1">سود ثابت هر بشکه (تومان)</label>
            <input
              type="number"
              dir="ltr"
              value={fixedProfit}
              onChange={(e) => setFixedProfit(Number(e.target.value))}
              className="w-full rounded-lg border border-emerald-400 bg-emerald-50/40 px-2.5 py-1.5 font-bold tabular-nums"
            />
          </div>
          <div>
            <label className="block text-slate-500 mb-1">نرخ دلار (تومان)</label>
            <input
              type="number"
              dir="ltr"
              value={usdToToman}
              onChange={(e) => setUsdToToman(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-semibold tabular-nums"
            />
          </div>
          <div>
            <label className="block text-slate-500 mb-1">نرخ درهم (تومان)</label>
            <input
              type="number"
              dir="ltr"
              value={aedToToman}
              onChange={(e) => setAedToToman(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-semibold tabular-nums"
            />
          </div>
          <div>
            <label className="block text-slate-500 mb-1">چگالی گازوئیل</label>
            <input
              type="number"
              step="0.005"
              dir="ltr"
              value={dieselDensity}
              onChange={(e) => setDieselDensity(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-semibold tabular-nums"
            />
          </div>
          <div>
            <label className="block text-slate-500 mb-1">هزینه بشکه خالی (اگر فله است)</label>
            <input
              type="number"
              dir="ltr"
              value={emptyBarrelCost}
              onChange={(e) => setEmptyBarrelCost(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-semibold tabular-nums"
            />
          </div>
          <div>
            <label className="block text-slate-500 mb-1">درصد حاشیه (اگر سود ثابت ۰ باشد)</label>
            <input
              type="number"
              step="0.5"
              dir="ltr"
              value={targetMargin}
              onChange={(e) => setTargetMargin(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-semibold tabular-nums"
            />
          </div>
        </div>
      </form>

      {/* Discovery Decision Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-emerald-950 text-white p-5 space-y-2 shadow-md">
          <div className="flex items-center justify-between text-xs text-emerald-300">
            <span>بهترین استعلام خرید گازوئیل</span>
            <Award className="w-4 h-4" />
          </div>
          <div className="text-xl font-extrabold tabular-nums">
            {summary.bestBuy
              ? `${formatNumberFa(summary.bestBuy.landedPerBarrelToman)} ت`
              : "—"}
          </div>
          <div className="text-xs text-emerald-200 truncate">
            {summary.bestBuy
              ? `${summary.bestBuy.sourceName} (${formatNumberFa(
                  summary.bestBuy.landedPerLiterToman
                )} ت/لیتر)`
              : "استعلامی ثبت نشده"}
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>میانگین وزنی دلال‌ها و واتساپ</span>
            <Activity className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 tabular-nums">
            {formatNumberFa(summary.weightedAvgPerBarrelToman)} ت
          </div>
          <div className="text-xs text-slate-500 tabular-nums">
            میانه: {formatNumberFa(summary.medianPerBarrelToman)} ت | اختلاف:{" "}
            {formatNumberFa(summary.spreadPercent, 1)}٪
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              پیشنهاد فروش (
              {state.config.fixedProfitPerBarrelToman > 0
                ? `+${formatNumberFa(state.config.fixedProfitPerBarrelToman)} ت سود`
                : `${formatNumberFa(state.config.targetMarginPercent, 1)}٪ سود`}
              )
            </span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-extrabold text-amber-700 tabular-nums">
            {formatNumberFa(summary.suggestedSellPerBarrelToman)} ت
          </div>
          <div className="text-xs text-slate-500 tabular-nums">
            {formatNumberFa(summary.suggestedSellPerLiterToman)} ت/لیتر •{" "}
            {formatUsd(summary.suggestedSellPerBarrelUsd)}
          </div>
        </div>

        <div className="rounded-2xl bg-slate-900 text-white p-5 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>نرخ مصوب فروش روز گازوئیل</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-extrabold tabular-nums">
            {formatNumberFa(summary.publishedSellPerBarrelToman)} ت
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => handlePublishPrice(false)}
            className="w-full py-1.5 px-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] cursor-pointer"
          >
            اعمال نرخ پیشنهادی روی فروش گازوئیل
          </button>
        </div>
      </div>

      {/* Custom Publish Bar */}
      <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-xs sm:text-sm text-amber-950">
          <strong>تثبیت دستی نرخ فروش هر بشکه گازوئیل:</strong> مثلاً{" "}
          <span className="tabular-nums font-bold">37500000</span> تومان:
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            dir="ltr"
            value={customPublishPrice}
            onChange={(e) => setCustomPublishPrice(e.target.value)}
            placeholder={String(summary.suggestedSellPerBarrelToman)}
            className="w-44 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-bold tabular-nums"
          />
          <button
            type="button"
            disabled={busy || !customPublishPrice}
            onClick={() => handlePublishPrice(true)}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
          >
            انتشار نرخ دلخواه
          </button>
        </div>
      </div>

      {/* Comparison Matrix */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-bold text-slate-900 text-sm sm:text-base">
              جدول مقایسه استعلام قیمت گازوئیل ({formatNumberFa(summary.quoteCount)} دلال و کانال واتساپ)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              مرتب‌شده از ارزان‌ترین قیمت تمام‌شده بشکه
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => handleSyncFeeds("LIVE")}
            className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer self-start"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            همگام‌سازی فیدهای API
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-bold">دلال / کانال واتساپ</th>
                <th className="py-3 px-3 font-bold">نرخ اعلامی</th>
                <th className="py-3 px-3 font-bold">بشکه و حمل</th>
                <th className="py-3 px-3 font-bold">تمام‌شده هر بشکه</th>
                <th className="py-3 px-3 font-bold">هر لیتر / دلار</th>
                <th className="py-3 px-3 font-bold">اختلاف با میانگین</th>
                <th className="py-3 px-3 font-bold">موجودی / یادداشت</th>
                <th className="py-3 px-3 font-bold">حذف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.quotes.map((q) => (
                <tr
                  key={q.id}
                  className={q.isBestBuy ? "bg-emerald-50/50" : "hover:bg-slate-50/80"}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-900">{q.sourceName}</span>
                      {q.isBestBuy && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                          ارزان‌ترین گزینه خرید
                        </span>
                      )}
                      {q.isArbitrageOpportunity && !q.isBestBuy && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                          زیر قیمت بازار
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {SOURCE_TYPE_LABELS[q.sourceType]} • {q.sourceCity}
                      {q.sourceContact ? ` • ${q.sourceContact}` : ""} •{" "}
                      {formatJalaliDateTime(q.recordedAt)}
                    </div>
                  </td>
                  <td className="py-3 px-3 tabular-nums">
                    <div className="font-bold text-slate-800">
                      {formatNumberFa(q.rawPrice, 2)} {q.currency}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {q.unit === "BARREL" ? "هر بشکه" : q.unit} ({q.includesBarrel ? "با بشکه" : "فله"})
                    </div>
                  </td>
                  <td className="py-3 px-3 tabular-nums text-slate-600">
                    {q.barrelPackagingAddedToman + q.freightPerBarrelToman > 0
                      ? `+${formatNumberFa(q.barrelPackagingAddedToman + q.freightPerBarrelToman)} ت`
                      : "تحویل کامل"}
                  </td>
                  <td className="py-3 px-3 tabular-nums">
                    <div className="font-extrabold text-sm text-slate-900">
                      {formatNumberFa(q.landedPerBarrelToman)} ت
                    </div>
                    <div className="text-[11px] text-emerald-700 font-semibold">
                      سود احتمالی: {formatNumberFa(summary.publishedSellPerBarrelToman - q.landedPerBarrelToman)} ت
                    </div>
                  </td>
                  <td className="py-3 px-3 tabular-nums">
                    <div className="font-semibold text-slate-800">
                      {formatNumberFa(q.landedPerLiterToman)} ت/لیتر
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {formatUsd(q.landedPerBarrelUsd)} / بشکه
                    </div>
                  </td>
                  <td className="py-3 px-3 tabular-nums">
                    <span
                      className={`font-bold ${
                        q.deviationFromWeightedPercent <= 0
                          ? "text-emerald-700"
                          : "text-rose-700"
                      }`}
                    >
                      {q.deviationFromWeightedPercent > 0 ? "+" : ""}
                      {formatNumberFa(q.deviationFromWeightedPercent, 2)}٪
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-semibold text-slate-800 tabular-nums">
                      {formatNumberFa(q.availableBarrels)} بشکه
                    </div>
                    <div className="text-[11px] text-slate-500 truncate max-w-40">
                      {q.notes || "—"}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <button
                      type="button"
                      onClick={() => handleDeleteQuote(q.id)}
                      title="حذف استعلام"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts + Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
          <h3 className="font-bold text-slate-900 text-sm sm:text-base">
            مقایسه دیداری قیمت دلال‌ها و کانال‌های واتساپ
          </h3>
          <SourceBreakdownChart quotes={summary.quotes} />
        </div>

        <div className="lg:col-span-6 rounded-2xl bg-white border border-slate-200 p-5 space-y-3">
          <h3 className="font-bold text-slate-900 text-sm sm:text-base">
            روند تغییرات قیمت گازوئیل
          </h3>
          <PriceHistoryChart points={historyPoints} />
        </div>
      </div>

      {/* Sources Directory */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-3">
        <h3 className="font-bold text-slate-900 text-sm sm:text-base">
          لیست دلال‌ها و کانال‌های واتساپ ({formatNumberFa(state.sources.length)})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {state.sources.map((src) => (
            <div
              key={src.id}
              className="rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-2 text-xs"
            >
              <div className="min-w-0">
                <div className="font-bold text-slate-900 truncate">{src.name}</div>
                <div className="text-[11px] text-slate-500">
                  {SOURCE_TYPE_LABELS[src.type]} • {src.contactInfo || src.city}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggleSource(src)}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] shrink-0 cursor-pointer ${
                  src.isActive
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {src.isActive ? "فعال" : "غیرفعال"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Quick Broker Phone / WhatsApp Quote Entry */}
      {showQuoteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleAddQuote}
            className="w-full max-w-lg rounded-2xl bg-white p-5 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto"
          >
            <h3 className="font-bold text-base text-slate-900">
              ثبت استعلام جدید گازوئیل (تماس تلفنی / واتساپ)
            </h3>

            {/* Smart SMS & WhatsApp Extractor */}
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                  <MessageSquareText className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>چسباندن پیامک یا پیام واتساپ (استخراج هوشمند شماره، مبلغ و تعداد):</span>
                </div>
                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className="px-2.5 py-1 rounded-lg bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold shrink-0 cursor-pointer"
                >
                  چسباندن (Paste)
                </button>
              </div>
              <textarea
                rows={3}
                value={whatsappPaste}
                onChange={(e) => {
                  const val = e.target.value;
                  setWhatsappPaste(val);
                  extractSmartSms(val);
                }}
                placeholder="پیامک یا متن واتساپ را اینجا قرار دهید؛ مثلاً: آقای محمدی +98 915 111 2233 گازوئیل ۲۵ بشکه ۳۶/۸۰۰ میلیون تحویل ری"
                className="w-full rounded-lg border border-emerald-300 bg-white p-2.5 text-xs leading-5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {parsedPreview && (
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  {matchedSourceName && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-700 text-white font-bold">
                      دلال شناخته‌شد: {matchedSourceName}
                    </span>
                  )}
                  {parsedPreview.phones.map((ph) => (
                    <button
                      key={ph}
                      type="button"
                      onClick={() => {
                        setQNewContact(ph);
                        if (!matchedSourceName && !parsedPreview.suggestedSourceName) {
                          setQuoteMode("NEW");
                          setQNewName(`شماره ${ph}`);
                        }
                      }}
                      className="px-2 py-0.5 rounded-md bg-white border border-emerald-300 text-emerald-900 font-bold tabular-nums cursor-pointer"
                      dir="ltr"
                    >
                      شماره: {ph}
                    </button>
                  ))}
                  {parsedPreview.priceToman && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold tabular-nums">
                      مبلغ: {formatNumberFa(parsedPreview.priceToman)}{" "}
                      {parsedPreview.currency === "TOMAN" ? "تومان" : parsedPreview.currency}
                    </span>
                  )}
                  {parsedPreview.availableBarrels && (
                    <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-900 font-bold tabular-nums">
                      {formatNumberFa(parsedPreview.availableBarrels)} بشکه
                    </span>
                  )}
                  {parsedPreview.city && (
                    <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-800 font-semibold">
                      {parsedPreview.city}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setQuoteMode("EXISTING")}
                className={`py-2 rounded-lg cursor-pointer ${
                  quoteMode === "EXISTING" ? "bg-white shadow-xs text-slate-900" : "text-slate-500"
                }`}
              >
                انتخاب از لیست دلال‌ها
              </button>
              <button
                type="button"
                onClick={() => setQuoteMode("NEW")}
                className={`py-2 rounded-lg cursor-pointer ${
                  quoteMode === "NEW" ? "bg-white shadow-xs text-slate-900" : "text-slate-500"
                }`}
              >
                دلال یا کانال واتساپ جدید
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {quoteMode === "EXISTING" ? (
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    دلال یا کانال واتساپ
                  </label>
                  <select
                    value={qSourceId}
                    onChange={(e) => setQSourceId(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    {state.sources.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({SOURCE_TYPE_LABELS[s.type]})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">
                      نام دلال یا نام کانال واتساپ *
                    </label>
                    <input
                      required
                      value={qNewName}
                      onChange={(e) => setQNewName(e.target.value)}
                      placeholder="مثلاً دلال رضا یا کانال نرخ سوخت"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      نحوه استعلام
                    </label>
                    <select
                      value={qNewType}
                      onChange={(e) => setQNewType(e.target.value as PriceSourceType)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    >
                      <option value="BROKER_PHONE">دلال / تماس تلفنی</option>
                      <option value="WHATSAPP">کانال / گروه واتساپ</option>
                      <option value="DEPOT">انبار / بنکدار</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      شماره تماس / آیدی
                    </label>
                    <input
                      dir="ltr"
                      value={qNewContact}
                      onChange={(e) => setQNewContact(e.target.value)}
                      placeholder="0912..."
                      className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    />
                  </div>
                </>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">
                    مبلغ اعلام‌شده *
                  </label>
                  {qCurrency === "TOMAN" && qUnit === "BARREL" && (
                    <label className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={priceInMillions}
                        onChange={(e) => setPriceInMillions(e.target.checked)}
                        className="accent-emerald-600"
                      />
                      به میلیون (مثلاً 37)
                    </label>
                  )}
                </div>
                <input
                  required
                  type="number"
                  step="any"
                  dir="ltr"
                  value={qRawPrice}
                  onChange={(e) => setQRawPrice(e.target.value)}
                  placeholder={priceInMillions ? "37 یا 36.8" : "37000000"}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ارز و واحد
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <select
                    value={qCurrency}
                    onChange={(e) => setQCurrency(e.target.value as PriceCurrency)}
                    className="rounded-xl border border-slate-300 px-2 py-2"
                  >
                    <option value="TOMAN">تومان</option>
                    <option value="USD">دلار</option>
                    <option value="AED">درهم</option>
                  </select>
                  <select
                    value={qUnit}
                    onChange={(e) => setQUnit(e.target.value as PriceUnit)}
                    className="rounded-xl border border-slate-300 px-2 py-2"
                  >
                    <option value="BARREL">هر بشکه</option>
                    <option value="LITER">هر لیتر</option>
                    <option value="TON">هر تن</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  تعداد بشکه موجود
                </label>
                <input
                  type="number"
                  dir="ltr"
                  value={qAvailBarrels}
                  onChange={(e) => setQAvailBarrels(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  کرایه حمل اضافه (تومان)
                </label>
                <input
                  type="number"
                  dir="ltr"
                  value={qFreight}
                  onChange={(e) => setQFreight(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>

              <div className="sm:col-span-2 flex items-center gap-2">
                <input
                  id="incBarrel"
                  type="checkbox"
                  checked={qIncludesBarrel}
                  onChange={(e) => setQIncludesBarrel(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600"
                />
                <label htmlFor="incBarrel" className="font-semibold text-slate-700">
                  نرخ اعلام‌شده با احتساب بشکه است
                </label>
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  یادداشت (محل تحویل، شرایط تسویه)
                </label>
                <input
                  value={qNotes}
                  onChange={(e) => setQNotes(e.target.value)}
                  placeholder="مثلاً تحویل پای ماشین تسویه نقدی"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowQuoteModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
              >
                ثبت و مقایسه قیمت
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Add Broker / WhatsApp Channel */}
      {showSourceModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateSource}
            className="w-full max-w-lg rounded-2xl bg-white p-5 space-y-4 shadow-2xl"
          >
            <h3 className="font-bold text-base text-slate-900">
              افزودن دلال یا کانال واتساپ جدید
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  نام دلال / نام کانال واتساپ *
                </label>
                <input
                  required
                  value={sName}
                  onChange={(e) => setSName(e.target.value)}
                  placeholder="مثلاً آقای بلوچ یا کانال نرخ گازوئیل"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">نوع استعلام</label>
                <select
                  value={sType}
                  onChange={(e) => setSType(e.target.value as PriceSourceType)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  <option value="BROKER_PHONE">دلال / تماس تلفنی</option>
                  <option value="WHATSAPP">کانال / گروه واتساپ</option>
                  <option value="DEPOT">انبار / بنکدار</option>
                  <option value="EXCHANGE">مرجع / بورس</option>
                  <option value="API_FEED">فید خودکار API</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">محل / شهر</label>
                <input
                  value={sCity}
                  onChange={(e) => setSCity(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  شماره تماس / لینک کانال
                </label>
                <input
                  dir="ltr"
                  value={sContact}
                  onChange={(e) => setSContact(e.target.value)}
                  placeholder="0915..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  وزن اعتبار (۱۰ تا ۱۰۰)
                </label>
                <input
                  type="number"
                  min={10}
                  max={100}
                  dir="ltr"
                  value={sWeight}
                  onChange={(e) => setSWeight(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  کرایه پیش‌فرض هر بشکه (اختیاری)
                </label>
                <input
                  type="number"
                  dir="ltr"
                  value={sFreight}
                  onChange={(e) => setSFreight(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  آدرس JSON API (فقط در صورت اتصال خودکار)
                </label>
                <input
                  dir="ltr"
                  value={sApiUrl}
                  onChange={(e) => setSApiUrl(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSourceModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
              >
                ذخیره دلال / کانال
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Bulk CSV Import */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleImportCsv}
            className="w-full max-w-2xl rounded-2xl bg-white p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900">
                ورود گروهی استعلام‌های گازوئیل (CSV / اکسل)
              </h3>
              <label className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold cursor-pointer">
                انتخاب فایل CSV
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) setCsvText(await file.text());
                  }}
                />
              </label>
            </div>
            <textarea
              dir="ltr"
              rows={8}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-3 font-mono text-xs bg-slate-50"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer"
              >
                ورود و پردازش استعلام‌ها
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
