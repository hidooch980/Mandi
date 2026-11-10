const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function toPersianDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)] ?? d);
}

export function formatNumberFa(value: number, maximumFractionDigits = 0): string {
  if (!Number.isFinite(value)) return "۰";
  const formatted = new Intl.NumberFormat("fa-IR", {
    maximumFractionDigits,
  }).format(value);
  return formatted;
}

export function formatToman(value: number): string {
  return `${formatNumberFa(Math.round(value))} تومان`;
}

export function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return "$0.00";
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function gregorianToJalali(
  gy: number,
  gm: number,
  gd: number
): { jy: number; jm: number; jd: number } {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    355666 +
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) +
    gd +
    g_d_m[gm - 1];
  let jy = -1595 + 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm =
    days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { jy, jm, jd };
}

const JALALI_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatJalaliDate(isoOrDate: string | Date, withMonthName = false): string {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(date.getTime())) return "نامشخص";
  const tehranOffsetMs = 3.5 * 60 * 60 * 1000;
  const local = new Date(date.getTime() + tehranOffsetMs);
  const { jy, jm, jd } = gregorianToJalali(
    local.getUTCFullYear(),
    local.getUTCMonth() + 1,
    local.getUTCDate()
  );
  if (withMonthName) {
    return `${toPersianDigits(jd)} ${JALALI_MONTHS[jm - 1]} ${toPersianDigits(jy)}`;
  }
  return toPersianDigits(`${jy}/${pad2(jm)}/${pad2(jd)}`);
}

export function formatJalaliDateTime(isoOrDate: string | Date): string {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(date.getTime())) return "نامشخص";
  const tehranOffsetMs = 3.5 * 60 * 60 * 1000;
  const local = new Date(date.getTime() + tehranOffsetMs);
  const { jy, jm, jd } = gregorianToJalali(
    local.getUTCFullYear(),
    local.getUTCMonth() + 1,
    local.getUTCDate()
  );
  const hh = pad2(local.getUTCHours());
  const mm = pad2(local.getUTCMinutes());
  return toPersianDigits(`${jy}/${pad2(jm)}/${pad2(jd)} - ${hh}:${mm}`);
}
