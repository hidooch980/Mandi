import {
  getDb,
  getMarketConfig,
  getSmsConfig,
  listPriceSources,
} from "./db.ts";
import { getDieselDiscoverySummary, snapshotDieselHistory } from "./services.ts";
import {
  normalizeIranPhone,
  parseSmartMessage,
  renderInquiryMessage,
} from "./whatsapp-parser.ts";

const globalForScheduler = globalThis as unknown as {
  __petronabzSmsTimer?: ReturnType<typeof setInterval>;
};

export { renderInquiryMessage };

function isAllowedGatewayUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    // Block cloud metadata IP and loopback, allow LAN Android phone IPs (e.g. 192.168.x.x) or HTTPS
    if (
      host === "169.254.169.254" ||
      host.startsWith("169.254.") ||
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1"
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function dispatchHourlySmsInquiries(options?: {
  force?: boolean;
}): Promise<{
  ran: boolean;
  queuedCount: number;
  sentCount: number;
  failedCount: number;
  reason?: string;
}> {
  const force = options?.force ?? false;
  const config = getSmsConfig();

  if (!force && !config.isEnabled) {
    return { ran: false, queuedCount: 0, sentCount: 0, failedCount: 0, reason: "غیرفعال" };
  }

  const nowMs = Date.now();
  if (!force && config.nextRunAt) {
    const nextMs = Date.parse(config.nextRunAt);
    if (Number.isFinite(nextMs) && nowMs < nextMs) {
      return {
        ran: false,
        queuedCount: 0,
        sentCount: 0,
        failedCount: 0,
        reason: "هنوز زمان ارسال بعدی نرسیده است",
      };
    }
  }

  const db = getDb();
  const sources = listPriceSources().filter(
    (s) => s.isActive && s.isSmsTarget && normalizeIranPhone(s.contactInfo).length >= 10
  );

  const nowIso = new Date(nowMs).toISOString();
  const nextIso = new Date(
    nowMs + Math.max(config.intervalMinutes, 5) * 60_000
  ).toISOString();

  let queuedCount = 0;
  let sentCount = 0;
  let failedCount = 0;

  const insertLog = db.prepare(`
    INSERT INTO sms_logs (
      direction, source_id, source_name, phone, message, status, extracted_price_toman, created_at
    ) VALUES ('OUTBOUND', ?, ?, ?, ?, ?, NULL, ?)
  `);

  const hasGateway =
    config.androidGatewayUrl.trim().length > 0 &&
    isAllowedGatewayUrl(config.androidGatewayUrl.trim());

  for (const src of sources) {
    const phone = normalizeIranPhone(src.contactInfo);
    const message = renderInquiryMessage(config.messageTemplate, src.name);

    if (hasGateway) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const resp = await fetch(config.androidGatewayUrl.trim(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: phone,
            message,
            from: config.managerPhone,
            secret: config.gatewaySecret,
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (resp.ok) {
          insertLog.run(src.id, src.name, phone, message, "SENT", nowIso);
          sentCount += 1;
        } else {
          insertLog.run(src.id, src.name, phone, message, "FAILED", nowIso);
          failedCount += 1;
        }
      } catch {
        insertLog.run(src.id, src.name, phone, message, "FAILED", nowIso);
        failedCount += 1;
      }
    } else {
      insertLog.run(src.id, src.name, phone, message, "QUEUED", nowIso);
      queuedCount += 1;
    }
  }

  db.prepare(
    "UPDATE sms_config SET last_run_at = ?, next_run_at = ?, updated_at = ? WHERE id = 1"
  ).run(nowIso, nextIso, nowIso);

  return { ran: true, queuedCount, sentCount, failedCount };
}

export function processInboundSmsReply(params: {
  fromPhone: string;
  message: string;
}) {
  const db = getDb();
  const smsConfig = getSmsConfig();
  const marketConfig = getMarketConfig();
  const nowIso = new Date().toISOString();

  const normalizedPhone = normalizeIranPhone(params.fromPhone);
  const parsed = parseSmartMessage(params.message);
  const effectivePhone = normalizedPhone || parsed.phone || params.fromPhone.trim();

  const sources = listPriceSources();
  let matched = sources.find((s) => {
    const srcPhone = normalizeIranPhone(s.contactInfo);
    return srcPhone.length >= 10 && srcPhone === effectivePhone;
  });

  if (parsed.priceToman && parsed.priceToman > 0) {
    if (!matched) {
      const newName =
        parsed.suggestedSourceName || `دلال پیامکی (${effectivePhone || "ناشناس"})`;
      const created = db
        .prepare(
          `INSERT INTO price_sources (
            name, code, type, city, contact_info, api_url, confidence_weight,
            default_freight_per_barrel_toman, is_active, is_sms_target, created_at
          ) VALUES (?, ?, 'BROKER_PHONE', ?, ?, '', 85, 0, 1, 1, ?)`
        )
        .run(
          newName,
          `SMS-${Date.now().toString().slice(-6)}`,
          parsed.city || "استعلام پیامکی",
          effectivePhone,
          nowIso
        );
      matched = {
        id: Number(created.lastInsertRowid),
        name: newName,
        code: "",
        type: "BROKER_PHONE",
        city: parsed.city || "استعلام پیامکی",
        contactInfo: effectivePhone,
        apiUrl: "",
        confidenceWeight: 85,
        defaultFreightPerBarrelToman: 0,
        isActive: true,
        isSmsTarget: true,
        createdAt: nowIso,
      };
    }

    db.prepare(
      `INSERT INTO price_quotes (
        source_id, fuel_type, raw_price, currency, unit, barrel_liters, density,
        includes_barrel, freight_per_barrel_toman, available_barrels, notes,
        recorded_by, recorded_at
      ) VALUES (?, 'DIESEL', ?, ?, ?, ?, ?, 1, ?, ?, ?, 'پاسخ پیامک خودکار', ?)`
    ).run(
      matched.id,
      parsed.priceToman,
      parsed.currency,
      parsed.unit,
      marketConfig.defaultBarrelLiters,
      marketConfig.dieselDensity,
      matched.defaultFreightPerBarrelToman,
      parsed.availableBarrels ?? 10,
      params.message.trim().slice(0, 180),
      nowIso
    );

    if (smsConfig.autoDiscoverOnReply) {
      const updatedSummary = getDieselDiscoverySummary();
      db.prepare(
        "UPDATE market_config SET published_diesel_barrel_toman = ?, updated_at = ? WHERE id = 1"
      ).run(updatedSummary.suggestedSellPerBarrelToman, nowIso);
    }

    snapshotDieselHistory();

    db.prepare(
      `INSERT INTO sms_logs (
        direction, source_id, source_name, phone, message, status, extracted_price_toman, created_at
      ) VALUES ('INBOUND', ?, ?, ?, ?, 'DISCOVERED', ?, ?)`
    ).run(
      matched.id,
      matched.name,
      effectivePhone,
      params.message.trim(),
      parsed.priceToman,
      nowIso
    );

    return {
      ok: true,
      status: "DISCOVERED" as const,
      matchedSourceName: matched.name,
      extractedPriceToman: parsed.priceToman,
      summary: getDieselDiscoverySummary(),
    };
  }

  db.prepare(
    `INSERT INTO sms_logs (
      direction, source_id, source_name, phone, message, status, extracted_price_toman, created_at
    ) VALUES ('INBOUND', ?, ?, ?, ?, 'UNPARSED', NULL, ?)`
  ).run(
    matched?.id ?? null,
    matched?.name ?? "شماره ناشناس",
    effectivePhone,
    params.message.trim(),
    nowIso
  );

  return {
    ok: true,
    status: "UNPARSED" as const,
    matchedSourceName: matched?.name ?? "شماره ناشناس",
    extractedPriceToman: null,
    summary: getDieselDiscoverySummary(),
  };
}

export function ensureSmsSchedulerStarted(): void {
  if (globalForScheduler.__petronabzSmsTimer) return;
  globalForScheduler.__petronabzSmsTimer = setInterval(() => {
    dispatchHourlySmsInquiries({ force: false }).catch(() => {});
  }, 60_000);
  if (typeof globalForScheduler.__petronabzSmsTimer.unref === "function") {
    globalForScheduler.__petronabzSmsTimer.unref();
  }
}
