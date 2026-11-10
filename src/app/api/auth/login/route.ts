import { NextResponse } from "next/server";
import {
  buildSessionCookieOptions,
  createSessionToken,
} from "@/lib/auth";
import { jsonError } from "@/lib/api-helpers";
import { getDb, mapUserRow } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      identifier?: string;
      password?: string;
    };
    const identifier = (body.identifier ?? "").trim();
    const password = body.password ?? "";

    if (!identifier || !password) {
      return jsonError("شماره موبایل یا ایمیل و رمز عبور الزامی است.", 400);
    }

    const db = getDb();
    const row = db
      .prepare(
        "SELECT * FROM users WHERE (phone = ? OR lower(email) = lower(?)) AND is_active = 1 LIMIT 1"
      )
      .get(identifier, identifier) as Record<string, unknown> | undefined;

    if (!row || !verifyPassword(password, String(row.password_hash))) {
      return jsonError("اطلاعات ورود صحیح نیست.", 401);
    }

    const user = mapUserRow(row);
    const token = createSessionToken(user.id, user.role);
    const res = NextResponse.json({ ok: true, user });
    res.cookies.set(buildSessionCookieOptions(token));
    return res;
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "خطا در ورود به سیستم",
      500
    );
  }
}
