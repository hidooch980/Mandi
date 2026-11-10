import { NextResponse } from "next/server";
import { jsonError, requireStaffUser } from "@/lib/api-helpers";
import { getDb } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireStaffUser();
  if (auth.response) return auth.response;

  try {
    const body = (await req.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };
    const currentPassword = body.currentPassword ?? "";
    const newPassword = (body.newPassword ?? "").trim();

    if (!currentPassword || newPassword.length < 6) {
      return jsonError(
        "رمز فعلی و رمز جدید (حداقل ۶ کاراکتر) الزامی است.",
        400
      );
    }

    const db = await getDb();
    const row = await db.get<{ id: number; password_hash: string }>(
      "SELECT id, password_hash FROM users WHERE id = ?",
      auth.user.id
    );
    if (!row || !verifyPassword(currentPassword, String(row.password_hash))) {
      return jsonError("رمز عبور فعلی اشتباه است.", 401);
    }

    const nextHash = hashPassword(newPassword);
    await db.run(
      "UPDATE users SET password_hash = ? WHERE id = ?",
      nextHash,
      auth.user.id
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "خطا در تغییر رمز عبور",
      500
    );
  }
}
