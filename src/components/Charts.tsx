"use client";

import { formatJalaliDate, formatNumberFa } from "@/lib/jalali";
import type { NormalizedQuote, PriceHistoryPoint } from "@/lib/types";

export function PriceHistoryChart({
  points,
}: {
  points: PriceHistoryPoint[];
}) {
  if (!points || points.length === 0) {
    return (
      <div className="h-52 flex items-center justify-center text-sm text-slate-400">
        داده‌ای برای نمایش روند قیمت ثبت نشده است.
      </div>
    );
  }

  const width = 680;
  const height = 220;
  const padX = 56;
  const padY = 24;

  const allValues = points.flatMap((p) => [
    p.bestBuyBarrelToman,
    p.weightedAvgBarrelToman,
    p.publishedSellBarrelToman,
  ]);
  const minVal = Math.min(...allValues) * 0.99;
  const maxVal = Math.max(...allValues) * 1.01;
  const range = Math.max(maxVal - minVal, 1);

  const getX = (idx: number) =>
    points.length === 1
      ? width / 2
      : padX + (idx / (points.length - 1)) * (width - padX * 2);

  const getY = (val: number) =>
    height - padY - ((val - minVal) / range) * (height - padY * 2);

  const buildPath = (extractor: (p: PriceHistoryPoint) => number) =>
    points
      .map((p, idx) => `${idx === 0 ? "M" : "L"} ${getX(idx)} ${getY(extractor(p))}`)
      .join(" ");

  const bestPath = buildPath((p) => p.bestBuyBarrelToman);
  const avgPath = buildPath((p) => p.weightedAvgBarrelToman);
  const sellPath = buildPath((p) => p.publishedSellBarrelToman);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
          <span className="w-3 h-1.5 rounded-full bg-emerald-500" />
          بهترین قیمت کشف‌شده خرید
        </span>
        <span className="inline-flex items-center gap-1.5 text-sky-700 font-medium">
          <span className="w-3 h-1.5 rounded-full bg-sky-500" />
          میانگین وزنی بازار
        </span>
        <span className="inline-flex items-center gap-1.5 text-amber-700 font-medium">
          <span className="w-3 h-1.5 rounded-full bg-amber-500" />
          نرخ مصوب فروش بشکه‌ای
        </span>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[460px] h-52 select-none"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = height - padY - ratio * (height - padY * 2);
            const val = minVal + ratio * range;
            return (
              <g key={ratio}>
                <line
                  x1={padX}
                  x2={width - padX}
                  y1={y}
                  y2={y}
                  className="stroke-slate-200 dark:stroke-slate-700"
                  strokeDasharray="4 4"
                />
                <text
                  x={padX - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  className="fill-slate-500 dark:fill-slate-400"
                >
                  {formatNumberFa(Math.round(val / 1_000_000), 2)}م
                </text>
              </g>
            );
          })}

          <path d={avgPath} fill="none" stroke="#0ea5e9" strokeWidth="2.2" />
          <path d={bestPath} fill="none" stroke="#10b981" strokeWidth="2.6" />
          <path d={sellPath} fill="none" stroke="#f59e0b" strokeWidth="2.4" strokeDasharray="5 3" />

          {points.map((p, idx) => {
            const x = getX(idx);
            const showLabel =
              idx === 0 ||
              idx === points.length - 1 ||
              idx % Math.max(1, Math.floor(points.length / 4)) === 0;
            return (
              <g key={p.id}>
                <circle
                  cx={x}
                  cy={getY(p.bestBuyBarrelToman)}
                  r="3.5"
                  fill="#10b981"
                />
                <circle
                  cx={x}
                  cy={getY(p.publishedSellBarrelToman)}
                  r="3.5"
                  fill="#f59e0b"
                />
                {showLabel && (
                  <text
                    x={x}
                    y={height - 6}
                    textAnchor="middle"
                    fontSize="10"
                    className="fill-slate-500 dark:fill-slate-400"
                  >
                    {formatJalaliDate(p.recordedAt)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export function SourceBreakdownChart({
  quotes,
}: {
  quotes: NormalizedQuote[];
}) {
  if (quotes.length === 0) {
    return (
      <div className="text-sm text-slate-400 py-8 text-center">
        هنوز استعلامی برای مقایسه ثبت نشده است.
      </div>
    );
  }

  const maxLanded = Math.max(...quotes.map((q) => q.landedPerBarrelToman), 1);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-xs bg-slate-800" />
          نرخ پایه سوخت
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-xs bg-amber-400" />
          هزینه بشکه و پرکردن
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-xs bg-sky-400" />
          کرایه حمل تا مقصد
        </span>
      </div>

      <div className="space-y-2.5">
        {quotes.map((q) => {
          const basePct = (q.basePerBarrelToman / maxLanded) * 100;
          const packPct = (q.barrelPackagingAddedToman / maxLanded) * 100;
          const freightPct = (q.freightPerBarrelToman / maxLanded) * 100;

          return (
            <div key={q.id} className="space-y-1">
              <div className="flex items-center justify-between text-xs gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-slate-800 truncate">
                    {q.sourceName}
                  </span>
                  {q.isBestBuy && (
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold shrink-0">
                      بهترین خرید
                    </span>
                  )}
                </div>
                <span className="font-bold text-slate-900 tabular-nums shrink-0">
                  {formatNumberFa(q.landedPerBarrelToman)} ت
                </span>
              </div>
              <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden flex">
                <div
                  style={{ width: `${basePct}%` }}
                  className="bg-slate-800 dark:bg-emerald-500 h-full"
                  title={`پایه: ${formatNumberFa(q.basePerBarrelToman)}`}
                />
                {packPct > 0 && (
                  <div
                    style={{ width: `${packPct}%` }}
                    className="bg-amber-400 h-full"
                    title={`بشکه: ${formatNumberFa(q.barrelPackagingAddedToman)}`}
                  />
                )}
                {freightPct > 0 && (
                  <div
                    style={{ width: `${freightPct}%` }}
                    className="bg-sky-400 h-full"
                    title={`حمل: ${formatNumberFa(q.freightPerBarrelToman)}`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
