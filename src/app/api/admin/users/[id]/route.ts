import { NextResponse } from "next/server";
import { jsonError, requireStaffUser } from "@/lib/api-helpers";
import { getDb, mapUserRow } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import type { UserRole } from "@/lib/types";

export const runtime = "nodejs";

const ALLOWED_ROLES: UserRole[] = ["ADMIN", "SALES", "CUSTOMER"];

async function fetchSortedUsers() {
  const db = await getDb();
  const rows = await db.all<Record<string, unknown>>(
    "SELECT * FROM users ORDER BY CASE role WHEN 'ADMIN' THEN 1 WHEN 'SALES' THEN 2 ELSE 3 END, id ASC"
  );
  return rows.map(mapUserRow);
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffUser();
  if (auth.response) return auth.response;

  if (auth.user.role !== "ADMIN") {
    return jsonError("ویرایش کاربران فقط برای مدیر کل مجاز است.", 403);
  }

  const { id } = await context.params;
  const userId = Number(id);
  if (!userId) return jsonError("شناسه کاربر معتبر نیست.", 400);

  try {
    const body = (await req.json()) as Partial<{
      isActive: boolean;
      role: UserRole;
      newPassword: string;
    }>;

    const db = await getDb();
    const target = await db.get<Record<string, unknown>>(
      "SELECT * FROM users WHERE id = ?",
      userId
    );
    if (!target) return jsonError("کاربر یافت نشد.", 404);

    if (userId === auth.user.id && body.isActive === false) {
      return jsonError("نمی‌توانید حساب فعال خودتان را غیرفعال کنید.", 400);
    }
    if (
      userId === auth.user.id &&
      body.role !== undefined &&
      body.role !== "ADMIN"
    ) {
      return jsonError("نمی‌توانید دسترسی مدیر کل حساب خودتان را کاهش دهید.", 400);
    }

    const nextActive =
      body.isActive !== undefined
        ? body.isActive
          ? 1
          : 0
        : Number(target.is_active);
    const nextRole: UserRole =
      body.role && ALLOWED_ROLES.includes(body.role)
        ? body.role
        : (target.role as UserRole);

    if (body.newPassword !== undefined) {
      const cleanPwd = body.newPassword.trim();
      if (cleanPwd.length < 6) {
        return jsonError("رمز عبور جدید باید حداقل ۶ کاراکتر باشد.", 400);
      }
      await db.run(
        "UPDATE users SET is_active = ?, role = ?, password_hash = ? WHERE id = ?",
        nextActive,
        nextRole,
        hashPassword(cleanPwd),
        userId
      );
    } else {
      await db.run(
        "UPDATE users SET is_active = ?, role = ? WHERE id = ?",
        nextActive,
        nextRole,
        userId
      );
    }

    return NextResponse.json({
      ok: true,
      users: await fetchSortedUsers(),
    });
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "خطا در ویرایش اکانت",
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

  if (auth.user.role !== "ADMIN") {
    return jsonError("حذف کاربر فقط برای مدیر کل مجاز است.", 403);
  }

  const { id } = await context.params;
  const userId = Number(id);
  if (!userId) return jsonError("شناسه کاربر معتبر نیست.", 400);
  if (userId === auth.user.id) {
    return jsonError("نمی‌توانید اکانت فعلی خودتان را حذف کنید.", 400);
  }

  const db = await getDb();
  const target = await db.get<{ id: number; role: string }>(
    "SELECT id, role FROM users WHERE id = ?",
    userId
  );
  if (!target) return jsonError("کاربر یافت نشد.", 404);

  if (target.role === "ADMIN") {
    const admins = await db.get<{ cnt: number | string }>(
      "SELECT COUNT(*) AS cnt FROM users WHERE role = 'ADMIN' AND is_active = 1"
    );
    if (Number(admins?.cnt ?? 0) <= 1) {
      return jsonError("حداقل یک مدیر کل فعال باید در سیستم باقی بماند.", 400);
    }
  }

  await db.run("DELETE FROM users WHERE id = ?", userId);
  return NextResponse.json({
    ok: true,
    users: await fetchSortedUsers(),
  });
}
