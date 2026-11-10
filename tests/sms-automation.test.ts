import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("hourly SMS dispatch queues inquiries for selected targets and inbound reply triggers auto price discovery", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "petronabz-sms-test-"));
  const tempDb = path.join(tempDir, "sms.db");
  process.env.PETRONABZ_DB_PATH = tempDb;

  const { getDb, getSmsConfig, listSmsLogs } = await import("../src/lib/db.ts");
  const { dispatchHourlySmsInquiries, processInboundSmsReply } = await import(
    "../src/lib/sms-automation.ts"
  );

  // Trigger initial seed and verify default sms_config
  const smsCfg = await getSmsConfig();
  assert.equal(smsCfg.intervalMinutes, 60);
  assert.ok(smsCfg.gatewaySecret.length >= 12);

  // Clean DB starts with 0 sources; register a targeted broker source first
  const db = await getDb();
  await db.run(
    `INSERT INTO price_sources (
      name, code, type, city, contact_info, api_url, confidence_weight,
      default_freight_per_barrel_toman, is_active, is_sms_target, created_at
    ) VALUES (?, ?, 'BROKER_PHONE', ?, ?, '', 92, 0, 1, 1, ?)`,
    "دلال علی محمدی (تلفنی)",
    "BRK-ALI",
    "انبار شرق",
    "09151112233",
    new Date().toISOString()
  );

  // Dispatch hourly SMS batch for targeted brokers
  const dispatchResult = await dispatchHourlySmsInquiries({ force: true });
  assert.equal(dispatchResult.ran, true);
  assert.equal(dispatchResult.queuedCount, 1);

  const outboundLogs = await listSmsLogs(10);
  assert.equal(outboundLogs.length, 1);
  assert.equal(outboundLogs[0].direction, "OUTBOUND");
  assert.equal(outboundLogs[0].status, "QUEUED");

  // Simulate inbound SMS reply from broker Ali (09151112233) with a cheaper price 36,700,000
  const replyOutcome = await processInboundSmsReply({
    fromPhone: "+98 915 111 2233",
    message: "سلام گازوئیل بشکه امروز ۳۶ و ۷۰۰ تحویل انبار",
  });

  assert.equal(replyOutcome.status, "DISCOVERED");
  assert.equal(replyOutcome.extractedPriceToman, 36700000);
  assert.equal(replyOutcome.matchedSourceName, "دلال علی محمدی (تلفنی)");
  assert.equal(replyOutcome.summary.bestBuy?.landedPerBarrelToman, 36700000);

  // Clean up test DB
  await db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});
