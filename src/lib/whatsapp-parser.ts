const PERSIAN_TO_EN: Record<string, string> = {
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9",
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
  "٫": ".",
  "٬": ",",
};

export function toEnglishDigits(input: string): string {
  return input
    .replace(/[\u200c\u200e\u200f]/g, " ")
    .replace(/[۰-۹٠-٩٫٬]/g, (ch) => PERSIAN_TO_EN[ch] ?? ch);
}

export function normalizeIranPhone(raw: string): string {
  const digits = toEnglishDigits(raw).replace(/\D/g, "");
  if (digits.startsWith("0098") && digits.length >= 14) {
    return "0" + digits.slice(4, 14);
  }
  if (digits.startsWith("98") && digits.length === 12 && digits[2] === "9") {
    return "0" + digits.slice(2);
  }
  if (digits.startsWith("9") && digits.length === 10) {
    return "0" + digits;
  }
  if (digits.startsWith("09") && digits.length === 11) {
    return digits;
  }
  if (digits.startsWith("0") && digits.length >= 10 && digits.length <= 11) {
    return digits;
  }
  return digits;
}

export interface ParsedSmartMessage {
  suggestedSourceName: string;
  sourceType: "BROKER_PHONE" | "WHATSAPP" | "DEPOT";
  priceToman: number | null;
  currency: "TOMAN" | "USD" | "AED";
  unit: "BARREL" | "LITER" | "TON";
  phone: string;
  phones: string[];
  availableBarrels: number | null;
  city: string;
  notes: string;
}

const KNOWN_CITIES = [
  "تهران",
  "باقرشهر",
  "ری",
  "اصفهان",
  "بندرعباس",
  "بندر",
  "زاهدان",
  "چابهار",
  "سراوان",
  "خاش",
  "ایرانشهر",
  "مشهد",
  "تبریز",
  "شیراز",
  "اهواز",
  "قم",
  "قزوین",
  "کرمان",
  "مرز",
];

/**
 * Extracts phone numbers, price, barrel quantity, city, and sender name
 * from Iranian SMS or WhatsApp messages.
 */
export function parseSmartMessage(rawText: string): ParsedSmartMessage {
  const normalized = toEnglishDigits(rawText).trim();

  // 1. Extract all Iranian mobile & landline numbers (supports +98, 0098, spaces, dashes)
  const phoneRegex =
    /(?:\+?98|0098)?[\s\-\.]*0?9\d{2}[\s\-\.]*\d{3}[\s\-\.]*\d{4}\b|\b0[1-8]\d{1,2}[\s\-]?\d{7,8}\b/g;

  const matchedRawPhones: string[] = [];
  const phones: string[] = [];
  const seenPhones = new Set<string>();

  for (const m of normalized.matchAll(phoneRegex)) {
    const rawMatch = m[0];
    matchedRawPhones.push(rawMatch);
    const cleanPhone = normalizeIranPhone(rawMatch);
    if (cleanPhone.length >= 10 && !seenPhones.has(cleanPhone)) {
      seenPhones.add(cleanPhone);
      phones.push(cleanPhone);
    }
  }

  // Strip phone numbers before extracting price or barrel count
  let textWithoutPhones = normalized;
  for (const rawPh of matchedRawPhones) {
    textWithoutPhones = textWithoutPhones.replace(rawPh, " ");
  }

  // Also strip barrel size mentions like "220 لیتر" or "220 لیتری" so 220 isn't confused with price/qty
  const textForNumbers = textWithoutPhones.replace(/\b(?:200|210|220)\s*لیتر(?:ی)?/gi, " ");

  // 2. Detect unit and currency
  const isTon = /\bتن\b|mt|\bton\b/i.test(textForNumbers);
  const isLiter = /لیتر|لیتری|\bliter\b/i.test(textForNumbers);
  const unit: "BARREL" | "LITER" | "TON" = isTon
    ? "TON"
    : isLiter
      ? "LITER"
      : "BARREL";

  const isUsd = /دلار|\$|usd/i.test(textForNumbers);
  const isAed = /درهم|aed/i.test(textForNumbers);
  const currency: "TOMAN" | "USD" | "AED" = isUsd
    ? "USD"
    : isAed
      ? "AED"
      : "TOMAN";

  // 3. Extract barrel count if mentioned (e.g. "25 بشکه", "تعداد 10 بشکه", "15 عدد")
  let availableBarrels: number | null = null;
  const qtyMatch =
    textForNumbers.match(/(?:تعداد|موجودی|ظرفیت)\s*[:：]?\s*(\d{1,4})/) ||
    textForNumbers.match(/(\d{1,4})\s*(?:عدد\s*)?بشکه/);
  if (qtyMatch) {
    const q = Number(qtyMatch[1]);
    if (q >= 1 && q <= 5000) {
      availableBarrels = q;
    }
  }

  // 4. Extract price cleanly
  let priceToman: number | null = null;

  if (currency !== "TOMAN") {
    const cleaned = textForNumbers.replace(/[,،]/g, "");
    const numMatch = cleaned.match(/\d+(?:\.\d+)?/);
    if (numMatch) {
      priceToman = Number(numMatch[0]);
    }
  } else {
    // Pattern A: "37 میلیون و 500" or "37 میلیون 200 هزار" or "36.8 میلیون" or "36/8 میلیون"
    const millionAndPart = textForNumbers.match(
      /(\d+(?:[./]\d+)?)\s*میلیون(?:\s*و?\s*(\d{1,3})\s*(?:هزار)?)?/i
    );
    // Pattern B: "37 و 500" / "36 و 800" (common Iranian verbal/SMS shorthand)
    const millionAndShortcut = textForNumbers.match(
      /\b(\d{2})\s+و\s+(\d{3})\b/
    );
    // Pattern C: "37/500" or "37.800" or "37/500/000" or "37.500.000"
    const slashFull = textForNumbers.match(
      /\b(\d{2})[./](\d{3})[./](000)\b/
    );
    const slashHalf = textForNumbers.match(/\b(\d{2})[./](\d{3})\b/);

    if (millionAndPart) {
      const baseM = Number(millionAndPart[1].replace("/", "."));
      const extraK = millionAndPart[2] ? Number(millionAndPart[2]) : 0;
      if (Number.isFinite(baseM) && baseM > 0) {
        priceToman = Math.round(baseM * 1_000_000 + extraK * 1_000);
      }
    } else if (slashFull) {
      priceToman = Number(`${slashFull[1]}${slashFull[2]}000`);
    } else if (millionAndShortcut) {
      priceToman = Number(`${millionAndShortcut[1]}${millionAndShortcut[2]}000`);
    } else if (slashHalf) {
      priceToman = Number(`${slashHalf[1]}${slashHalf[2]}000`);
    } else {
      const cleaned = textForNumbers.replace(/[,،]/g, "");
      const numMatches = [...cleaned.matchAll(/\d+(?:\.\d+)?/g)]
        .map((m) => Number(m[0]))
        .filter((n) => n !== availableBarrels);

      const candidate = numMatches.find((n) => n >= 10);
      if (candidate !== undefined) {
        if (unit === "LITER") {
          priceToman =
            candidate < 1000 ? Math.round(candidate * 1000) : Math.round(candidate);
        } else if (candidate < 100) {
          priceToman = Math.round(candidate * 1_000_000);
        } else if (candidate >= 10000 && candidate < 100000) {
          priceToman = Math.round(candidate * 1_000);
        } else {
          priceToman = Math.round(candidate);
        }
      }
    }
  }

  // 5. Detect city with token boundary matching (so "ری" doesn't match inside "لیتری")
  const city =
    KNOWN_CITIES.find((c) => {
      const escaped = c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`(?:^|[\\s،,.\\-:])${escaped}(?=$|[\\s،,.\\-:])`);
      return re.test(textWithoutPhones);
    }) ?? "";

  // 6. Detect sender/broker name
  let suggestedSourceName = "";
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const firstLine = lines[0] ?? "";

  const labeledSender = rawText.match(
    /(?:فرستنده|نام|از طرف|تامین|دلال)\s*[:：]\s*([^\n\r,،\-]+)/
  );
  const titleName = rawText.match(
    /(?:آقای|حاج|مهندس|دلال|شرکت|کانال|گروه)\s+[^\n\r:،\-0-9۰-۹]{2,28}/
  );

  if (labeledSender) {
    suggestedSourceName = labeledSender[1].trim();
  } else if (firstLine.includes(":")) {
    suggestedSourceName = firstLine.split(":")[0].trim();
  } else if (firstLine.includes("-")) {
    suggestedSourceName = firstLine.split("-")[0].trim();
  } else if (titleName) {
    suggestedSourceName = titleName[0].trim();
  }

  // Strip stray phone numbers from suggested name
  for (const rawPh of matchedRawPhones) {
    suggestedSourceName = suggestedSourceName.replace(rawPh, "").trim();
  }
  suggestedSourceName = suggestedSourceName.slice(0, 48);

  const sourceType: "BROKER_PHONE" | "WHATSAPP" | "DEPOT" =
    /واتساپ|کانال|گروه/i.test(rawText)
      ? "WHATSAPP"
      : /انبار|پالایش/i.test(rawText)
        ? "DEPOT"
        : "BROKER_PHONE";

  return {
    suggestedSourceName,
    sourceType,
    priceToman,
    currency,
    unit,
    phone: phones[0] ?? "",
    phones,
    availableBarrels,
    city,
    notes: rawText.trim().slice(0, 180),
  };
}

// Keep backward-compatible export alias
export function parseWhatsAppQuoteText(rawText: string) {
  return parseSmartMessage(rawText);
}

export function renderInquiryMessage(template: string, name: string): string {
  return template.replace(/\{name\}/g, name.trim());
}
