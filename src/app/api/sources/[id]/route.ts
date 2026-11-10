import { NextResponse } from "next/server";
import { jsonError, requireStaffUser } from "@/lib/api-helpers";
import { getDb, listPriceSources } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const sourceId = Number(id);
  if (!sourceId) return jsonError("شناسه منبع معتبر نیست.", 400);

  try {
    const body = (await req.json()) as Partial<{
      isActive: boolean;
      isSmsTarget: boolean;
      contactInfo: string;
      confidenceWeight: number;
      defaultFreightPerBarrelToman: number;
      apiUrl: string;
    }>;

    const db = getDb();
    const row = db
      .prepare("SELECT * FROM price_sources WHERE id = ?")
      .get(sourceId) as Record<string, unknown> | undefined;
    if (!row) return jsonError("منبع یافت نشد.", 404);

    db.prepare(
      `UPDATE price_sources SET
        is_active = ?,
        is_sms_target = ?,
        contact_info = ?,
        confidence_weight = ?,
        default_freight_per_barrel_toman = ?,
        api_url = ?
       WHERE id = ?`
    ).run(
      body.isActive !== undefined ? (body.isActive ? 1 : 0) : Number(row.is_active),
      body.isSmsTarget !== undefined
        ? body.isSmsTarget
          ? 1
          : 0
        : Number(row.is_sms_target ?? 0),
      body.contactInfo !== undefined
        ? body.contactInfo.trim()
        : String(row.contact_info ?? ""),
      body.confidenceWeight !== undefined
        ? Math.min(100, Math.max(10, Number(body.confidenceWeight)))
        : Number(row.confidence_weight),
      body.defaultFreightPerBarrelToman !== undefined
        ? Math.max(Number(body.defaultFreightPerBarrelToman), 0)
        : Number(row.default_freight_per_barrel_toman),
      body.apiUrl !== undefined ? body.apiUrl.trim() : String(row.api_url),
      sourceId
    );

    return NextResponse.json({ ok: true, sources: listPriceSources() });
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "خطا در ویرایش منبع",
      500
    );
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const sourceId = Number(id);
  if (!sourceId) return jsonError("شناسه منبع معتبر نیست.", 400);

  const db = getDb();
  const res = db.prepare("DELETE FROM price_sources WHERE id = ?").run(sourceId);
  if (res.changes === 0) return jsonError("منبع یافت نشد.", 404);

  return NextResponse.json({ ok: true, sources: listPriceSources() });
}
