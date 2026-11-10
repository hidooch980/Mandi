import { NextResponse } from "next/server";
import { jsonError, requireStaffUser } from "@/lib/api-helpers";
import { createExpense, listExpenses } from "@/lib/db";
import type { ExpenseCategory } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_CATEGORIES: ExpenseCategory[] = [
  "FREIGHT",
  "WAREHOUSE_RENT",
  "SALARY",
  "BARREL_PACKAGING",
  "WASTAGE",
  "OTHER",
];

export async function GET() {
  const auth = await requireStaffUser();
  if (auth.response) return auth.response;

  return NextResponse.json({ ok: true, expenses: await listExpenses() });
}

export async function POST(req: Request) {
  const auth = await requireStaffUser();
  if (auth.response) return auth.response;

  try {
    const body = (await req.json()) as {
      title?: string;
      category?: ExpenseCategory;
      amountToman?: number;
      expenseDate?: string;
      note?: string;
    };

    const title = (body.title ?? "").trim();
    const amount = Number(body.amountToman ?? 0);
    const category: ExpenseCategory = ALLOWED_CATEGORIES.includes(
      body.category as ExpenseCategory
    )
      ? (body.category as ExpenseCategory)
      : "OTHER";
    const expenseDate =
      (body.expenseDate ?? "").trim() || new Date().toISOString().slice(0, 10);

    if (!title) {
      return jsonError("عنوان هزینه الزامی است.", 400);
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return jsonError("مبلغ هزینه معتبر (بزرگ‌تر از صفر) وارد کنید.", 400);
    }

    const expenses = await createExpense({
      title,
      category,
      amountToman: amount,
      expenseDate,
      note: body.note,
      createdBy: auth.user.name,
    });

    return NextResponse.json({ ok: true, expenses }, { status: 201 });
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "خطا در ثبت هزینه جاری",
      500
    );
  }
}
