import { NextResponse } from "next/server";
import { getCurrentUser, isStaffRole } from "./auth";
import type { PublicUser } from "./types";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function requireAuthenticatedUser(): Promise<
  { user: PublicUser; response?: never } | { user?: never; response: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      response: jsonError("لطفاً ابتدا وارد حساب کاربری خود شوید.", 401),
    };
  }
  return { user };
}

export async function requireStaffUser(): Promise<
  { user: PublicUser; response?: never } | { user?: never; response: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      response: jsonError("لطفاً ابتدا وارد حساب کاربری خود شوید.", 401),
    };
  }
  if (!isStaffRole(user.role)) {
    return {
      response: jsonError("این عملیات فقط برای مدیران و کارشناسان فروش مجاز است.", 403),
    };
  }
  return { user };
}
