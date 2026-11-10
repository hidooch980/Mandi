import { NextResponse } from "next/server";
import { jsonError, requireStaffUser } from "@/lib/api-helpers";
import { getLedgerSummary, recordLedgerEntry } from "@/lib/db";
import type { LedgerEntryType, PartyType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES: LedgerEntryType[] = [
  "DEBIT_RECEIVABLE",
  "CREDIT_PAYABLE",
  "RECEIPT_IN",
  "PAYMENT_OUT",
];

const ALLOWED_PARTY_TYPES: PartyType[] = ["BUYER", "SELLER", "OTHER"];

export async function GET() {
  const auth = await requireStaffUser();
  if (auth.response) return auth.response;

  const summary = await getLedgerSummary();
  return NextResponse.json({ ok: true, ...summary });
}

export async function POST(req: Request) {
  const auth = await requireStaffUser();
  if (auth.response) return auth.response;

  try {
    const body = (await req.json()) as {
      partyType?: PartyType;
      partyName?: string;
      partyPhone?: string;
      entryType?: LedgerEntryType;
      amountToman?: number;
      note?: string;
    };

    const partyName = (body.partyName ?? "").trim();
    const partyPhone = (body.partyPhone ?? "").trim();
    const amount = Number(body.amountToman ?? 0);
    const entryType = body.entryType;
    const partyType: PartyType = ALLOWED_PARTY_TYPES.includes(
      body.partyType as PartyType
    )
      ? (body.partyType as PartyType)
      : "OTHER";

    if (!partyName) {
      return jsonError("نام طرف حساب (بدهکار یا بستانکار) الزامی است.", 400);
    }
    if (!entryType || !ALLOWED_TYPES.includes(entryType)) {
      return jsonError("نوع سند حسابداری معتبر نیست.", 400);
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return jsonError("مبلغ معتبر (بزرگ‌تر از صفر) وارد کنید.", 400);
    }

    const summary = await recordLedgerEntry({
      partyType,
      partyName,
      partyPhone,
      entryType,
      amountToman: amount,
      note: body.note,
      createdBy: auth.user.name,
    });

    return NextResponse.json({ ok: true, ...summary }, { status: 201 });
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "خطا در ثبت سند بدهکار/بستانکار",
      500
    );
  }
}
