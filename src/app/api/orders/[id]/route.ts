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

  const order = getOrderById(orderId);
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

  const existing = getOrderById(orderId);
  if (!existing) return jsonError("سند یافت نشد.", 404);

  try {
    const body = (await req.json()) as Partial<{
      status: OrderStatus;
      paymentStatus: PaymentStatus;
      driverPlate: string;
      waybillNumber: string;
      notes: string;
    }>;

    const nextStatus = body.status ?? existing.status;
    const nextPayment = body.paymentStatus ?? existing.paymentStatus;
    const db = getDb();
    const now = new Date().toISOString();

    db.exec("BEGIN");
    try {
      if (existing.tradeType === "PURCHASE") {
        const wasDelivered = existing.status === "DELIVERED";
        const willBeDelivered = nextStatus === "DELIVERED";

        if (!wasDelivered && willBeDelivered) {
          for (const item of existing.items) {
            db.prepare(
              "UPDATE products SET stock_barrels = stock_barrels + ?, updated_at = ? WHERE id = ?"
            ).run(item.quantityBarrels, now, item.productId);
          }
        } else if (wasDelivered && !willBeDelivered) {
          for (const item of existing.items) {
            db.prepare(
              "UPDATE products SET stock_barrels = MAX(0, stock_barrels - ?), updated_at = ? WHERE id = ?"
            ).run(item.quantityBarrels, now, item.productId);
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
              db.prepare(
                "UPDATE products SET stock_barrels = stock_barrels + ?, updated_at = ? WHERE id = ?"
              ).run(item.quantityBarrels, now, item.productId);
            } else {
              db.prepare(
                "UPDATE products SET reserved_barrels = MAX(0, reserved_barrels - ?), updated_at = ? WHERE id = ?"
              ).run(item.quantityBarrels, now, item.productId);
            }
          }
        } else if (
          !wasDispatchedOrDelivered &&
          willBeDispatchedOrDelivered &&
          !wasCancelled
        ) {
          for (const item of existing.items) {
            db.prepare(
              `UPDATE products
               SET stock_barrels = MAX(0, stock_barrels - ?),
                   reserved_barrels = MAX(0, reserved_barrels - ?),
                   updated_at = ?
               WHERE id = ?`
            ).run(item.quantityBarrels, item.quantityBarrels, now, item.productId);
          }
        }
      }

      db.prepare(
        `UPDATE orders SET
          status = ?,
          payment_status = ?,
          driver_plate = ?,
          waybill_number = ?,
          notes = ?,
          updated_at = ?
        WHERE id = ?`
      ).run(
        nextStatus,
        nextPayment,
        body.driverPlate !== undefined ? body.driverPlate.trim() : existing.driverPlate,
        body.waybillNumber !== undefined
          ? body.waybillNumber.trim()
          : existing.waybillNumber,
        body.notes !== undefined ? body.notes.trim() : existing.notes,
        now,
        orderId
      );

      db.exec("COMMIT");
      return NextResponse.json({ ok: true, order: getOrderById(orderId) });
    } catch (innerErr) {
      db.exec("ROLLBACK");
      throw innerErr;
    }
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "خطا در بروزرسانی معامله",
      500
    );
  }
}
