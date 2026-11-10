import { NextResponse } from "next/server";
import { jsonError, requireStaffUser } from "@/lib/api-helpers";
import { deleteLedgerEntry, getLedgerSummary } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const entryId = Number(id);
  if (!entryId) return jsonError("شناسه سند حساب معتبر نیست.", 400);

  const ok = await deleteLedgerEntry(entryId);
  if (!ok) return jsonError("ردیف حساب یافت نشد.", 404);

  const summary = await getLedgerSummary();
  return NextResponse.json({ ok: true, ...summary });
}
