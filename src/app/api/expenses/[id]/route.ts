import { NextResponse } from "next/server";
import { jsonError, requireStaffUser } from "@/lib/api-helpers";
import { deleteExpense, listExpenses } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const expId = Number(id);
  if (!expId) return jsonError("شناسه هزینه معتبر نیست.", 400);

  const ok = await deleteExpense(expId);
  if (!ok) return jsonError("هزینه مورد نظر یافت نشد.", 404);

  return NextResponse.json({ ok: true, expenses: await listExpenses() });
}
