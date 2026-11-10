"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Clock,
  Copy,
  MessageSquare,
  Play,
  Plus,
  Send,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { formatJalaliDateTime, formatNumberFa } from "@/lib/jalali";
import {
  normalizeIranPhone,
  renderInquiryMessage,
} from "@/lib/whatsapp-parser";
import type { PriceSource, SmsConfig, SmsLogEntry } from "@/lib/types";

export function SmsAutomationClient({
  initialConfig,
  initialSources,
  initialLogs,
}: {
  initialConfig: SmsConfig;
  initialSources: PriceSource[];
  initialLogs: SmsLogEntry[];
}) {
  const [cfg, setCfg] = useState<SmsConfig>(initialConfig);
  const [sources, setSources] = useState<PriceSource[]>(initialSources);
  const [logs, setLogs] = useState<SmsLogEntry[]>(initialLogs);
  const [origin, setOrigin] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );
  const [copiedKey, setCopiedKey] = useState("");

  // Quick add target person
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonPhone, setNewPersonPhone] = useState("");
  const [newPersonCity, setNewPersonCity] = useState("تهران");

  // Inbound SMS test simulator
  const [simPhone, setSimPhone] = useState("09151112233");
  const [simMessage, setSimMessage] = useState(
    "سلام گازوئیل امروز ۳۶ و ۷۵۰ تحویل انبار"
  );

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function copyText(key: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(""), 2000);
  }

  async function handleSaveConfig(patch?: Partial<SmsConfig>) {
    setBusy(true);
    setFeedback(null);
    const next = { ...cfg, ...patch };
    try {
      const res = await fetch("/api/sms/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFeedback({ type: "err", text: data.error || "خطا در ذخیره تنظیمات" });
      } else {
        setCfg(data.config);
        setSources(data.sources);
        setLogs(data.logs);
        setFeedback({
          type: "ok",
          text: "تنظیمات استعلام پیامکی ساعتی با موفقیت ذخیره شد.",
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRunNow() {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/sms/run-now", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFeedback({ type: "err", text: data.error || "خطا در اجرای استعلام" });
      } else {
        setCfg(data.config);
        setLogs(data.logs);
        const r = data.result as {
          sentCount: number;
          queuedCount: number;
          failedCount: number;
        };
        setFeedback({
          type: "ok",
          text: `دور استعلام اجرا شد: ${formatNumberFa(r.sentCount)} ارسال مستقیم، ${formatNumberFa(
            r.queuedCount
          )} در صف سیم‌کارت گوشی مدیر، ${formatNumberFa(r.failedCount)} ناموفق.`,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleSmsTarget(src: PriceSource) {
    setBusy(true);
    try {
      const res = await fetch(`/api/sources/${src.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSmsTarget: !src.isSmsTarget }),
      });
      const data = await res.json();
      if (data.ok) setSources(data.sources);
    } finally {
      setBusy(false);
    }
  }

  async function handleAddTargetPerson(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPersonName,
          type: "BROKER_PHONE",
          city: newPersonCity,
          contactInfo: normalizeIranPhone(newPersonPhone) || newPersonPhone,
          isSmsTarget: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFeedback({ type: "err", text: data.error || "خطا در افزودن شخص" });
      } else {
        setSources(data.sources);
        setNewPersonName("");
        setNewPersonPhone("");
        setFeedback({
          type: "ok",
          text: "شخص جدید به لیست دریافت پیامک ساعتی اضافه شد.",
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSimulateInbound(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/sms/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: simPhone,
          message: simMessage,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFeedback({ type: "err", text: data.error || "خطا در پردازش پیامک" });
      } else {
        setLogs(data.logs);
        if (data.status === "DISCOVERED") {
          setFeedback({
            type: "ok",
            text: `پیامک از «${data.matchedSourceName}» پردازش و نرخ ${formatNumberFa(
              data.extractedPriceToman
            )} تومان در کشف قیمت گازوئیل ثبت شد!`,
          });
        } else {
          setFeedback({
            type: "err",
            text: "پیامک ثبت شد اما مبلغ معتبری داخل متن تشخیص داده نشد.",
          });
        }
      }
    } finally {
      setBusy(false);
    }
  }

  const pendingUrl = `${origin || "http://localhost:3000"}/api/sms/pending?secret=${cfg.gatewaySecret}`;
  const webhookUrl = `${origin || "http://localhost:3000"}/api/sms/webhook`;
  const smsTargetsCount = sources.filter(
    (s) => s.isActive && s.isSmsTarget && normalizeIranPhone(s.contactInfo).length >= 10
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-emerald-600" />
            <span>استعلام پیامکی ساعتی از سیم‌کارت مدیر و کشف قیمت خودکار</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            ارسال خودکار پیامک استعلام گازوئیل هر ۱ ساعت به اشخاص منتخب و ثبت خودکار قیمت از پاسخ پیامک‌ها
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => handleSaveConfig({ isEnabled: !cfg.isEnabled })}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold cursor-pointer ${
              cfg.isEnabled
                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                : "bg-slate-200 hover:bg-slate-300 text-slate-800"
            }`}
          >
            {cfg.isEnabled ? "اتوماسیون ساعتی: روشن ✓" : "اتوماسیون ساعتی: خاموش"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleRunNow}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Play className="w-4 h-4 text-amber-400" />
            ارسال استعلام همین الان
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

      {/* Status Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-1">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-emerald-600" />
            <span>بازه زمانی استعلام</span>
          </div>
          <div className="text-lg font-extrabold text-slate-900 tabular-nums">
            هر {formatNumberFa(cfg.intervalMinutes)} دقیقه (
            {cfg.intervalMinutes === 60 ? "۱ ساعت" : `${formatNumberFa(cfg.intervalMinutes)} دقیقه`})
          </div>
          <div className="text-[11px] text-slate-500">
            آخرین اجرا: {cfg.lastRunAt ? formatJalaliDateTime(cfg.lastRunAt) : "هنوز اجرا نشده"}
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-1">
          <div className="text-xs text-slate-500">تعداد اشخاص منتخب پیامک</div>
          <div className="text-lg font-extrabold text-emerald-700 tabular-nums">
            {formatNumberFa(smsTargetsCount)} نفر فعال
          </div>
          <div className="text-[11px] text-slate-500 tabular-nums">
            سیم‌کارت مدیر: {cfg.managerPhone}
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-1">
          <div className="text-xs text-slate-500">زمان اجرای بعدی</div>
          <div className="text-sm font-extrabold text-slate-900 tabular-nums">
            {cfg.isEnabled && cfg.nextRunAt
              ? formatJalaliDateTime(cfg.nextRunAt)
              : "اتوماسیون متوقف است"}
          </div>
          <div className="text-[11px] text-slate-500">
            پاسخ‌های دریافتی خودکار وارد کشف قیمت می‌شوند
          </div>
        </div>
      </div>

      {/* Config + Add Person */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveConfig();
          }}
          className="lg:col-span-7 rounded-2xl bg-white border border-slate-200 p-5 space-y-4"
        >
          <h2 className="font-bold text-slate-900 text-sm sm:text-base border-b border-slate-100 pb-3">
            تنظیمات سیم‌کارت مدیر و متن پیامک ساعتی
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                شماره سیم‌کارت مدیر
              </label>
              <input
                dir="ltr"
                value={cfg.managerPhone}
                onChange={(e) => setCfg({ ...cfg, managerPhone: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                فاصله تکرار (دقیقه — ۶۰ = هر یک ساعت)
              </label>
              <input
                type="number"
                min={5}
                max={1440}
                dir="ltr"
                value={cfg.intervalMinutes}
                onChange={(e) =>
                  setCfg({ ...cfg, intervalMinutes: Number(e.target.value) })
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                متن پیامک استعلام (متغیر {"{name}"} به نام هر شخص تبدیل می‌شود)
              </label>
              <textarea
                rows={2}
                value={cfg.messageTemplate}
                onChange={(e) =>
                  setCfg({ ...cfg, messageTemplate: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 p-2.5"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                آدرس درگاه گوشی اندروید مدیر (اختیاری — در صورت خالی بودن از حالت صف Pull استفاده می‌شود)
              </label>
              <input
                dir="ltr"
                value={cfg.androidGatewayUrl}
                onChange={(e) =>
                  setCfg({ ...cfg, androidGatewayUrl: e.target.value })
                }
                placeholder="http://192.168.100.x:8080/send-sms"
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </div>

            <div className="sm:col-span-2 flex items-center gap-2">
              <input
                id="autoPub"
                type="checkbox"
                checked={cfg.autoDiscoverOnReply}
                onChange={(e) =>
                  setCfg({ ...cfg, autoDiscoverOnReply: e.target.checked })
                }
                className="w-4 h-4 accent-emerald-600"
              />
              <label htmlFor="autoPub" className="font-semibold text-slate-700">
                پس از دریافت پیامک هر دلال، نرخ پیشنهادی فروش گازوئیل خودکار بروزرسانی شود
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
          >
            ذخیره تنظیمات پیامکی
          </button>
        </form>

        {/* Inbound SMS Auto-Discovery Tester */}
        <form
          onSubmit={handleSimulateInbound}
          className="lg:col-span-5 rounded-2xl bg-emerald-950 text-white p-5 space-y-4 shadow-md"
        >
          <div className="flex items-center gap-2 font-bold text-sm text-emerald-300">
            <Sparkles className="w-4 h-4" />
            <span>تست دریافت پیامک دلال و کشف قیمت خودکار</span>
          </div>
          <p className="text-[11px] text-emerald-100/80 leading-5">
            وقتی گوشی اندروید مدیر پاسخ پیامک دلال را به سیستم بفرستد (یا اینجا تست
            کنید)، سیستم خودکار شماره و مبلغ را استخراج و در جدول کشف قیمت ثبت می‌کند.
          </p>
          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-emerald-200 mb-1">شماره فرستنده پیامک</label>
              <input
                required
                dir="ltr"
                value={simPhone}
                onChange={(e) => setSimPhone(e.target.value)}
                className="w-full rounded-xl bg-slate-900 border border-emerald-700 px-3 py-2 text-white font-bold"
              />
            </div>
            <div>
              <label className="block text-emerald-200 mb-1">متن پیامک پاسخ دلال</label>
              <textarea
                required
                rows={2}
                value={simMessage}
                onChange={(e) => setSimMessage(e.target.value)}
                className="w-full rounded-xl bg-slate-900 border border-emerald-700 p-2.5 text-white"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
          >
            پردازش پیامک و اجرای کشف قیمت
          </button>
        </form>
      </div>

      {/* Selected Recipients Table + Add Person */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="font-bold text-slate-900 text-sm sm:text-base">
            انتخاب اشخاص مشخص برای ارسال پیامک هر ۱ ساعت
          </h2>
          <form
            onSubmit={handleAddTargetPerson}
            className="flex flex-wrap items-center gap-2 text-xs"
          >
            <input
              required
              value={newPersonName}
              onChange={(e) => setNewPersonName(e.target.value)}
              placeholder="نام شخص"
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 w-32"
            />
            <input
              required
              dir="ltr"
              value={newPersonPhone}
              onChange={(e) => setNewPersonPhone(e.target.value)}
              placeholder="0915..."
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 w-32"
            />
            <input
              value={newPersonCity}
              onChange={(e) => setNewPersonCity(e.target.value)}
              placeholder="شهر"
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 w-24"
            />
            <button
              type="submit"
              disabled={busy}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              افزودن
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {sources.map((src) => {
            const cleanPhone = normalizeIranPhone(src.contactInfo);
            const hasValidPhone = cleanPhone.length >= 10;
            const smsHref = hasValidPhone
              ? `sms:${cleanPhone}?body=${encodeURIComponent(
                  renderInquiryMessage(cfg.messageTemplate, src.name)
                )}`
              : undefined;
            return (
              <div
                key={src.id}
                className={`rounded-xl border p-3.5 flex flex-col justify-between gap-3 ${
                  src.isSmsTarget && hasValidPhone
                    ? "border-emerald-300 bg-emerald-50/40"
                    : "border-slate-200 bg-slate-50/40"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-900">{src.name}</div>
                    <div className="text-[11px] text-slate-500 tabular-nums mt-0.5" dir="ltr">
                      {hasValidPhone ? cleanPhone : "بدون شماره معتبر"}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy || !hasValidPhone}
                    onClick={() => handleToggleSmsTarget(src)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer disabled:opacity-40 ${
                      src.isSmsTarget && hasValidPhone
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {src.isSmsTarget ? "در لیست ساعتی" : "غیرفعال"}
                  </button>
                </div>
                {smsHref && (
                  <a
                    href={smsHref}
                    className="inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-semibold text-[11px]"
                  >
                    <Send className="w-3 h-3 text-emerald-600" />
                    ارسال فوری با سیم‌کارت همین گوشی
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Android SIM Connection Guide */}
      <div className="rounded-2xl bg-slate-950 text-white p-5 space-y-4">
        <div className="flex items-center gap-2 font-bold text-sm sm:text-base text-amber-400">
          <Smartphone className="w-5 h-5" />
          <span>اتصال سیم‌کارت واقعی گوشی اندروید مدیر (MacroDroid / Tasker)</span>
        </div>
        <p className="text-xs text-slate-300 leading-6">
          مرورگر وب به دلایل امنیتی امکان ارسال مخفی پیامک از سیم‌کارت را ندارد؛ برای
          ارسال و دریافت خودکار ۱۰۰٪ واقعی از <strong>سیم‌کارت داخل گوشی اندروید مدیر</strong>،
          اپ رایگان <strong>MacroDroid</strong> را روی گوشی سیم‌کارت مدیر نصب و این دو
          لینک را در آن ثبت کنید:
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-3.5 space-y-2">
            <div className="font-bold text-emerald-300">
              ۱. دریافت پیامک‌های در صف ارسال (تایمر هر ۵ یا ۶۰ دقیقه):
            </div>
            <div className="flex items-center justify-between gap-2 bg-slate-950 rounded-lg px-2.5 py-2">
              <code dir="ltr" className="text-[11px] text-sky-300 truncate">
                GET {pendingUrl}
              </code>
              <button
                type="button"
                onClick={() => copyText("pending", pendingUrl)}
                className="text-slate-300 hover:text-white shrink-0 inline-flex items-center gap-1 cursor-pointer"
              >
                {copiedKey === "pending" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                کپی
              </button>
            </div>
            <div className="text-[11px] text-slate-400">
              خروجی آرایه <code dir="ltr">jobs</code> شامل شماره، متن و شناسه است؛ گوشی پیامک را می‌فرستد و با <code dir="ltr">POST</code> تایید می‌کند.
            </div>
          </div>

          <div className="rounded-xl bg-slate-900 border border-slate-800 p-3.5 space-y-2">
            <div className="font-bold text-amber-300">
              ۲. فوروارد پاسخ پیامکی دلال به کشف قیمت (Trigger: SMS Received):
            </div>
            <div className="flex items-center justify-between gap-2 bg-slate-950 rounded-lg px-2.5 py-2">
              <code dir="ltr" className="text-[11px] text-amber-300 truncate">
                POST {webhookUrl}
              </code>
              <button
                type="button"
                onClick={() => copyText("webhook", webhookUrl)}
                className="text-slate-300 hover:text-white shrink-0 inline-flex items-center gap-1 cursor-pointer"
              >
                {copiedKey === "webhook" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                کپی
              </button>
            </div>
            <div className="text-[11px] text-slate-400" dir="ltr">
              JSON: {`{"secret":"${cfg.gatewaySecret}","from":"{sms_number}","message":"{sms_message}"}`}
            </div>
          </div>
        </div>
      </div>

      {/* SMS Logs */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 sm:p-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 text-sm sm:text-base">
            گزارش پیامک‌های ارسالی و پاسخ‌های کشف‌شده ({formatNumberFa(logs.length)})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">نوع</th>
                <th className="py-3 px-3">شخص / شماره</th>
                <th className="py-3 px-3">متن پیامک</th>
                <th className="py-3 px-3">قیمت کشف‌شده</th>
                <th className="py-3 px-3">وضعیت</th>
                <th className="py-3 px-3">زمان</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        log.direction === "INBOUND"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-sky-100 text-sky-800"
                      }`}
                    >
                      {log.direction === "INBOUND" ? "دریافتی" : "ارسالی"}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-bold text-slate-900">{log.sourceName || "—"}</div>
                    <div className="text-[11px] text-slate-500 tabular-nums" dir="ltr">
                      {log.phone}
                    </div>
                  </td>
                  <td className="py-3 px-3 max-w-xs truncate text-slate-700">
                    {log.message}
                  </td>
                  <td className="py-3 px-3 font-bold tabular-nums text-emerald-700">
                    {log.extractedPriceToman
                      ? `${formatNumberFa(log.extractedPriceToman)} ت`
                      : "—"}
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                      {log.status === "QUEUED"
                        ? "در صف گوشی مدیر"
                        : log.status === "SENT"
                          ? "ارسال‌شده"
                          : log.status === "DISCOVERED"
                            ? "کشف قیمت ثبت شد"
                            : log.status === "UNPARSED"
                              ? "بدون مبلغ معتبر"
                              : "ناموفق"}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-500 tabular-nums">
                    {formatJalaliDateTime(log.createdAt)}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    هنوز پیامکی ثبت نشده است.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
