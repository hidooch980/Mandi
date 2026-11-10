import { NextResponse } from "next/server";
import { jsonError, requireStaffUser } from "@/lib/api-helpers";
import { resetToCleanDatabase } from "@/lib/db";

export const runtime = "nodejs";

export async function POST() {
  const auth = await requireStaffUser();
  if (auth.response) return auth.response;

  if (auth.user.role !== "ADMIN") {
    return jsonError("فقط مدیر کل مجاز به ریست و خام‌سازی دیتابیس است.", 403);
  }

  try {
    await resetToCleanDatabase({ keepAdmins: true });
    return NextResponse.json({
      ok: true,
      message: "تمام داده‌های نمونه و آزمایشی پاک شد و دیتابیس به حالت خام برگشت.",
    });
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "خطا در پاکسازی و ریست دیتابیس",
      500
    );
  }
}
