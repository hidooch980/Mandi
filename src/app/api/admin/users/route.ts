import { NextResponse } from "next/server";
import { jsonError, requireStaffUser } from "@/lib/api-helpers";
import { getDb, mapUserRow } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import type { UserRole } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ROLES: UserRole[] = ["ADMIN", "SALES", "CUSTOMER"];

export async function GET() {
  const auth = await requireStaffUser();
  if (auth.response) return auth.response;

  if (auth.user.role !== "ADMIN") {
    return jsonError("مدیریت اکانت‌ها فقط برای مدیر کل مجاز است.", 403);
  }

  const db = await getDb();
  const rows = await db.all<Record<string, unknown>>(
    "SELECT * FROM users ORDER BY CASE role WHEN 'ADMIN' THEN 1 WHEN 'SALES' THEN 2 ELSE 3 END, id ASC"
  );

  return NextResponse.json({
    ok: true,
    users: rows.map(mapUserRow),
  });
}

export async function POST(req: Request) {
  const auth = await requireStaffUser();
  if (auth.response) return auth.response;

  if (auth.user.role !== "ADMIN") {
    return jsonError("ایجاد کاربر جدید فقط برای مدیر کل مجاز است.", 403);
  }

  try {
    const body = (await req.json()) as {
      name?: string;
      phone?: string;
      email?: string;
      companyName?: string;
      city?: string;
      role?: UserRole;
      password?: string;
    };

    const name = (body.name ?? "").trim();
    const phone = (body.phone ?? "").trim();
    const password = (body.password ?? "").trim();
    const role: UserRole = ALLOWED_ROLES.includes(body.role as UserRole)
      ? (body.role as UserRole)
      : "SALES";

    if (!name || !phone) {
      return jsonError("نام و شماره موبایل برای ورود الزامی است.", 400);
    }
    if (password.length < 6) {
      return jsonError("رمز عبور اکانت جدید باید حداقل ۶ کاراکتر باشد.", 400);
    }

    const db = await getDb();
    const exists = await db.get("SELECT id FROM users WHERE phone = ?", phone);
    if (exists) {
      return jsonError("اکانتی با این شماره موبایل قبلاً ثبت شده است.", 409);
    }

    const passwordHash = hashPassword(password);
    const created = await db.run(
      `INSERT INTO users (name, phone, email, company_name, city, role, password_hash, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      name,
      phone,
      (body.email ?? "").trim(),
      (body.companyName ?? "").trim(),
      (body.city ?? "تهران").trim(),
      role,
      passwordHash,
      new Date().toISOString()
    );

    const rows = await db.all<Record<string, unknown>>(
      "SELECT * FROM users ORDER BY CASE role WHEN 'ADMIN' THEN 1 WHEN 'SALES' THEN 2 ELSE 3 END, id ASC"
    );

    return NextResponse.json(
      {
        ok: true,
        userId: Number(created.lastInsertRowid),
        users: rows.map(mapUserRow),
      },
      { status: 201 }
    );
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "خطا در ایجاد اکانت جدید",
      500
    );
  }
}
