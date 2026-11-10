import { NextResponse } from "next/server";
import {
  jsonError,
  requireAuthenticatedUser,
  requireStaffUser,
} from "@/lib/api-helpers";
import { isStaffRole } from "@/lib/auth";
import { getDb, getOrderById } from "@/lib/db";
import type { OrderStatus, PaymentStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const orderId = Number(id);
  if (!orderId) return jsonError("شناسه سند معتبر نیست.", 400);

  const order = await getOrderById(orderId);
  if (!order) return jsonError("سند یافت نشد.", 404);

  if (!isStaffRole(auth.user.role) && order.customerId !== auth.user.id) {
    return jsonError("شما به این سند دسترسی ندارید.", 403);
  }

  return NextResponse.json({ ok: true, order });
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const orderId = Number(id);
  if (!orderId) return jsonError("شناسه سند معتبر نیست.", 400);

  const existing = await getOrderById(orderId);
  if (!existing) return jsonError("سند یافت نشد.", 404);

  try {
    const body = (await req.json()) as Partial<{
      status: OrderStatus;
      paymentStatus: PaymentStatus;
      paidAmountToman: number;
      driverPlate: string;
      waybillNumber: string;
      notes: string;
    }>;

    const nextStatus = body.status ?? existing.status;
    let nextPaid = existing.paidToman;
    let nextPayment = body.paymentStatus ?? existing.paymentStatus;

    if (body.paidAmountToman !== undefined) {
      nextPaid = Math.max(
        0,
        Math.min(Math.round(Number(body.paidAmountToman)), Math.round(existing.totalToman))
      );
      nextPayment =
        nextPaid >= existing.totalToman
          ? "PAID"
          : nextPaid > 0
            ? "PARTIAL"
            : "UNPAID";
    } else if (body.paymentStatus === "PAID") {
      nextPaid = Math.round(existing.totalToman);
    } else if (body.paymentStatus === "UNPAID") {
      nextPaid = 0;
    }
    const db = await getDb();
    const now = new Date().toISOString();

    await db.transaction(async (tx) => {
      if (existing.tradeType === "PURCHASE") {
        const wasDelivered = existing.status === "DELIVERED";
        const willBeDelivered = nextStatus === "DELIVERED";

        if (!wasDelivered && willBeDelivered) {
          for (const item of existing.items) {
            await tx.run(
              "UPDATE products SET stock_barrels = stock_barrels + ?, updated_at = ? WHERE id = ?",
              item.quantityBarrels,
              now,
              item.productId
            );
          }
        } else if (wasDelivered && !willBeDelivered) {
          for (const item of existing.items) {
            await tx.run(
              `UPDATE products
               SET stock_barrels = CASE WHEN stock_barrels - ? < 0 THEN 0 ELSE stock_barrels - ? END,
                   updated_at = ?
               WHERE id = ?`,
              item.quantityBarrels,
              item.quantityBarrels,
              now,
              item.productId
            );
          }
        }
      } else {
        const wasDispatchedOrDelivered =
          existing.status === "DISPATCHED" || existing.status === "DELIVERED";
        const willBeDispatchedOrDelivered =
          nextStatus === "DISPATCHED" || nextStatus === "DELIVERED";
        const wasCancelled = existing.status === "CANCELLED";
        const willBeCancelled = nextStatus === "CANCELLED";

        if (!wasCancelled && willBeCancelled) {
          for (const item of existing.items) {
            if (wasDispatchedOrDelivered) {
              await tx.run(
                "UPDATE products SET stock_barrels = stock_barrels + ?, updated_at = ? WHERE id = ?",
                item.quantityBarrels,
                now,
                item.productId
              );
            } else {
              await tx.run(
                `UPDATE products
                 SET reserved_barrels = CASE WHEN reserved_barrels - ? < 0 THEN 0 ELSE reserved_barrels - ? END,
                     updated_at = ?
                 WHERE id = ?`,
                item.quantityBarrels,
                item.quantityBarrels,
                now,
                item.productId
              );
            }
          }
        } else if (
          !wasDispatchedOrDelivered &&
          willBeDispatchedOrDelivered &&
          !wasCancelled
        ) {
          for (const item of existing.items) {
            await tx.run(
              `UPDATE products
               SET stock_barrels = CASE WHEN stock_barrels - ? < 0 THEN 0 ELSE stock_barrels - ? END,
                   reserved_barrels = CASE WHEN reserved_barrels - ? < 0 THEN 0 ELSE reserved_barrels - ? END,
                   updated_at = ?
               WHERE id = ?`,
              item.quantityBarrels,
              item.quantityBarrels,
              item.quantityBarrels,
              item.quantityBarrels,
              now,
              item.productId
            );
          }
        }
      }

      await tx.run(
        `UPDATE orders SET
          status = ?,
          payment_status = ?,
          paid_toman = ?,
          driver_plate = ?,
          waybill_number = ?,
          notes = ?,
          updated_at = ?
        WHERE id = ?`,
        nextStatus,
        nextPayment,
        nextPaid,
        body.driverPlate !== undefined ? body.driverPlate.trim() : existing.driverPlate,
        body.waybillNumber !== undefined
          ? body.waybillNumber.trim()
          : existing.waybillNumber,
        body.notes !== undefined ? body.notes.trim() : existing.notes,
        now,
        orderId
      );
    });

    return NextResponse.json({ ok: true, order: await getOrderById(orderId) });
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "خطا در بروزرسانی معامله",
      500
    );
  }
}
