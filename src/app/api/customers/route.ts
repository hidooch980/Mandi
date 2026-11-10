import { NextResponse } from "next/server";
import { jsonError, requireStaffUser } from "@/lib/api-helpers";
import {
  getDb,
  listBuyersWithStats,
  listSellersWithStats,
} from "@/lib/db";
import { hashPassword } from "@/lib/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireStaffUser();
  if (auth.response) return auth.response;

  const [buyers, sellers] = await Promise.all([
    listBuyersWithStats(),
    listSellersWithStats(),
  ]);

  return NextResponse.json({
    ok: true,
    customers: buyers,
    buyers,
    sellers,
  });
}

export async function POST(req: Request) {
  const auth = await requireStaffUser();
  if (auth.response) return auth.response;

  try {
    const body = (await req.json()) as {
      name?: string;
      phone?: string;
      email?: string;
      companyName?: string;
      city?: string;
      password?: string;
    };

    const name = (body.name ?? "").trim();
    const phone = (body.phone ?? "").trim();
    if (!name || !phone) {
      return jsonError("نام و شماره تماس خریدار الزامی است.", 400);
    }

    const db = await getDb();
    const exists = await db.get("SELECT id FROM users WHERE phone = ?", phone);
    if (exists) return jsonError("خریداری با این شماره تماس قبلاً ثبت شده است.", 409);

    const passwordHash = hashPassword(body.password || "client1234");
    const res = await db.run(
      `INSERT INTO users (name, phone, email, company_name, city, role, password_hash, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, 'CUSTOMER', ?, 1, ?)`,
      name,
      phone,
      (body.email ?? "").trim(),
      (body.companyName ?? "").trim(),
      (body.city ?? "تهران").trim(),
      passwordHash,
      new Date().toISOString()
    );

    const [buyers, sellers] = await Promise.all([
      listBuyersWithStats(),
      listSellersWithStats(),
    ]);

    return NextResponse.json(
      {
        ok: true,
        customerId: Number(res.lastInsertRowid),
        buyers,
        sellers,
      },
      { status: 201 }
    );
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "خطا در افزودن خریدار",
      500
    );
  }
}
