import { NextResponse } from "next/server";
import { jsonError, requireStaffUser } from "@/lib/api-helpers";
import { getDb, listWarehouses } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, warehouses: await listWarehouses() });
}

export async function POST(req: Request) {
  const auth = await requireStaffUser();
  if (auth.response) return auth.response;

  try {
    const body = (await req.json()) as {
      name?: string;
      city?: string;
      address?: string;
      emptyBarrels?: number;
      managerName?: string;
    };

    const name = (body.name ?? "").trim();
    const city = (body.city ?? "").trim();
    if (!name || !city) {
      return jsonError("نام و شهر انبار الزامی است.", 400);
    }

    const db = await getDb();
    await db.run(
      `INSERT INTO warehouses (name, city, address, empty_barrels, manager_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      name,
      city,
      (body.address ?? "").trim(),
      Math.max(Math.floor(Number(body.emptyBarrels ?? 0)), 0),
      (body.managerName ?? "").trim(),
      new Date().toISOString()
    );

    return NextResponse.json(
      { ok: true, warehouses: await listWarehouses() },
      { status: 201 }
    );
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "خطا در ایجاد انبار",
      500
    );
  }
}

export async function PATCH(req: Request) {
  const auth = await requireStaffUser();
  if (auth.response) return auth.response;

  try {
    const body = (await req.json()) as {
      id?: number;
      emptyBarrels?: number;
    };
    const id = Number(body.id);
    if (!id) return jsonError("شناسه انبار الزامی است.", 400);

    const db = await getDb();
    const res = await db.run(
      "UPDATE warehouses SET empty_barrels = ? WHERE id = ?",
      Math.max(Math.floor(Number(body.emptyBarrels ?? 0)), 0),
      id
    );
    if (res.changes === 0) return jsonError("انبار یافت نشد.", 404);

    return NextResponse.json({ ok: true, warehouses: await listWarehouses() });
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "خطا در بروزرسانی موجودی بشکه خالی",
      500
    );
  }
}
