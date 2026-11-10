import { NextResponse } from "next/server";
import { jsonError, requireStaffUser } from "@/lib/api-helpers";
import { getDb } from "@/lib/db";
import { getFullDiscoveryState } from "@/lib/services";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const quoteId = Number(id);
  if (!quoteId) return jsonError("شناسه استعلام معتبر نیست.", 400);

  const db = await getDb();
  const res = await db.run("DELETE FROM price_quotes WHERE id = ?", quoteId);
  if (res.changes === 0) {
    return jsonError("استعلام مورد نظر پیدا نشد.", 404);
  }

  return NextResponse.json({
    ok: true,
    state: await getFullDiscoveryState(),
  });
}
