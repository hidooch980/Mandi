import type {
  PriceCurrency,
  PriceSourceType,
  PriceUnit,
} from "./types";

export interface ParsedImportQuoteRow {
  sourceName: string;
  sourceType: PriceSourceType;
  city: string;
  contactInfo: string;
  rawPrice: number;
  currency: PriceCurrency;
  unit: PriceUnit;
  includesBarrel: boolean;
  freightPerBarrelToman: number;
  confidenceWeight: number;
  availableBarrels: number;
  notes: string;
}

function normalizeToken(val: string | undefined): string {
  return (val ?? "").trim().replace(/^"|"$/g, "");
}

function parseSourceType(val: string): PriceSourceType {
  const upper = val.toUpperCase().trim();
  if (upper.includes("WHATSAPP") || val.includes("واتساپ") || val.includes("کانال"))
    return "WHATSAPP";
  if (upper.includes("DEPOT") || val.includes("انبار") || val.includes("بنکدار"))
    return "DEPOT";
  if (upper.includes("EXCHANGE") || val.includes("بورس")) return "EXCHANGE";
  if (upper.includes("API") || val.includes("فید")) return "API_FEED";
  return "BROKER_PHONE";
}

function parseCurrency(val: string): PriceCurrency {
  const upper = val.toUpperCase().trim();
  if (upper === "USD" || val.includes("دلار")) return "USD";
  if (upper === "AED" || val.includes("درهم")) return "AED";
  return "TOMAN";
}

function parseUnit(val: string): PriceUnit {
  const upper = val.toUpperCase().trim();
  if (upper === "LITER" || upper === "L" || val.includes("لیتر")) return "LITER";
  if (upper === "TON" || upper === "MT" || val.includes("تن")) return "TON";
  if (upper === "KG" || val.includes("کیلو")) return "KG";
  return "BARREL";
}

function parseBool(val: string): boolean {
  const lower = val.toLowerCase().trim();
  return (
    lower === "true" ||
    lower === "1" ||
    lower === "yes" ||
    val.includes("بله") ||
    val.includes("با بشکه")
  );
}

export function parseCsvQuotes(csvText: string): {
  rows: ParsedImportQuoteRow[];
  errors: string[];
} {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { rows: [], errors: ["فایل یا متن ورودی خالی است."] };
  }

  const delimiter = lines[0].includes(";") ? ";" : ",";
  const firstCells = lines[0].split(delimiter).map(normalizeToken);
  const hasHeader =
    firstCells.some((c) => /person|source|price|نام|دلال|کانال|قیمت/i.test(c)) ||
    Number.isNaN(Number(firstCells[4]));

  const dataLines = hasHeader ? lines.slice(1) : lines;
  const rows: ParsedImportQuoteRow[] = [];
  const errors: string[] = [];

  dataLines.forEach((line, idx) => {
    const cells = line.split(delimiter).map(normalizeToken);
    const sourceName = cells[0];
    const rawPrice = Number((cells[4] ?? "").replace(/,/g, ""));

    if (!sourceName || Number.isNaN(rawPrice) || rawPrice <= 0) {
      errors.push(`ردیف ${idx + 1}: نام دلال/کانال یا قیمت معتبر نیست.`);
      return;
    }

    rows.push({
      sourceName,
      sourceType: parseSourceType(cells[1] ?? "BROKER_PHONE"),
      city: cells[2] || "محل / منطقه",
      contactInfo: cells[3] || "",
      rawPrice,
      currency: parseCurrency(cells[5] ?? "TOMAN"),
      unit: parseUnit(cells[6] ?? "BARREL"),
      includesBarrel: parseBool(cells[7] ?? "true"),
      freightPerBarrelToman: Math.max(Number(cells[8] ?? 0) || 0, 0),
      confidenceWeight: Math.min(
        100,
        Math.max(10, Number(cells[9] ?? 85) || 85)
      ),
      availableBarrels: Math.max(Number(cells[10] ?? 20) || 0, 0),
      notes: cells[11] || "استعلام گازوئیل (ایمپورت CSV)",
    });
  });

  return { rows, errors };
}

export const SAMPLE_IMPORT_CSV = `brokerOrChannel,sourceType,city,contactInfo,rawPrice,currency,unit,includesBarrel,freightPerBarrelToman,confidenceWeight,availableBarrels,notes
دلال علی محمدی (تماس تلفنی),BROKER_PHONE,بندر,09123331122,36800000,TOMAN,BARREL,true,0,90,15,تماس تلفنی ساعت ۱۰
کانال واتساپ بازار گازوئیل,WHATSAPP,مرز,گروه واتساپ,37000000,TOMAN,BARREL,true,0,88,25,اعلام نرخ کانال واتساپ
حاج حسین کریمی (تلفنی),BROKER_PHONE,انبار جنوب,09174445566,37250000,TOMAN,BARREL,true,0,85,12,تحویل فوری بشکه‌ای`;
