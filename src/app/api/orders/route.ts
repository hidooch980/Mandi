import { NextResponse } from "next/server";
import {
  jsonError,
  requireAuthenticatedUser,
} from "@/lib/api-helpers";
import { isStaffRole } from "@/lib/auth";
import { getDb, getMarketConfig, getOrderById, listOrders } from "@/lib/db";
import { calculateOrderEconomics } from "@/lib/pricing-engine";
import {
  generateNextOrderNumber,
  getDieselDiscoverySummary,
  listProductsWithPricing,
} from "@/lib/services";
import type { OrderStatus, PaymentStatus, TradeType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuthenticatedUser();
  if (auth.response) return auth.response;

  const orders = isStaffRole(auth.user.role)
    ? await listOrders()
    : await listOrders(auth.user.id);

  return NextResponse.json({ ok: true, orders });
}

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser();
  if (auth.response) return auth.response;

  try {
    const body = (await req.json()) as {
      tradeType?: TradeType;
      productId?: number;
      quantityBarrels?: number;
      customUnitPriceBarrelToman?: number;
      receiveImmediately?: boolean;
      destinationCity?: string;
      deliveryAddress?: string;
      paymentMethod?: string;
      freightToman?: number;
      discountPercent?: number;
      customerId?: number;
      customerName?: string;
      customerPhone?: string;
      customerCompany?: string;
      notes?: string;
    };

    const staffUser = isStaffRole(auth.user.role);
    const tradeType: TradeType =
      body.tradeType === "PURCHASE" ? "PURCHASE" : "SALE";

    if (tradeType === "PURCHASE" && !staffUser) {
      return jsonError("ثبت خرید سوخت فقط برای مدیر و همکار مجاز است.", 403);
    }

    const productId = Number(body.productId);
    const quantityBarrels = Math.floor(Number(body.quantityBarrels ?? 0));
    const destinationCity = (body.destinationCity ?? auth.user.city ?? "تهران").trim();

    if (!productId || quantityBarrels <= 0) {
      return jsonError("انتخاب نوع سوخت (بنزین/گازوئیل) و تعداد معتبر الزامی است.", 400);
    }

    const products = await listProductsWithPricing(false);
    const product = products.find((p) => p.id === productId && p.isActive);
    if (!product) {
      return jsonError("محصول انتخاب‌شده موجود یا فعال نیست.", 404);
    }

    if (tradeType === "SALE") {
      if (quantityBarrels < product.minOrderBarrels) {
        return jsonError(
          `حداقل تعداد فروش برای این کد ${product.minOrderBarrels} است.`,
          400
        );
      }
      const availableStock = Math.max(
        product.stockBarrels - product.reservedBarrels,
        0
      );
      if (quantityBarrels > availableStock) {
        return jsonError(
          `موجودی قابل فروش در انبار فقط ${availableStock} واحد است.`,
          400
        );
      }
    }

    const config = await getMarketConfig();
    const dieselSummary = await getDieselDiscoverySummary(config);
    const bestDieselCostBasis =
      dieselSummary.bestBuy?.landedPerBarrelToman
        ? dieselSummary.bestBuy.landedPerBarrelToman *
          (product.barrelLiters / Math.max(config.defaultBarrelLiters, 1))
        : product.effectivePricePerBarrelToman;

    // Prefer recorded lastCostPerBarrelToman on the product (e.g. 37M diesel, 8M 70L gasoline)
    const costBasisPerBarrel =
      product.lastCostPerBarrelToman > 0
        ? product.lastCostPerBarrelToman
        : product.fuelType === "DIESEL"
          ? bestDieselCostBasis
          : product.effectivePricePerBarrelToman * 0.9;

    const unitPricePerBarrel =
      staffUser &&
      body.customUnitPriceBarrelToman &&
      body.customUnitPriceBarrelToman > 0
        ? Number(body.customUnitPriceBarrelToman)
        : product.effectivePricePerBarrelToman;

    const discountPercent =
      tradeType === "PURCHASE"
        ? 0
        : staffUser && body.discountPercent !== undefined
          ? Math.max(0, Math.min(25, Number(body.discountPercent)))
          : 0;

    const freightToman = Math.max(Number(body.freightToman ?? 0), 0);

    const economics = calculateOrderEconomics({
      quantityBarrels,
      barrelLiters: product.barrelLiters,
      density: product.density,
      unitPricePerBarrelToman: unitPricePerBarrel,
      freightToman,
      discountPercent,
      vatPercent: config.vatPercent,
      costBasisPerBarrelToman: costBasisPerBarrel,
      usdToToman: config.usdToToman,
      isPurchase: tradeType === "PURCHASE",
    });

    const customerId =
      tradeType === "SALE"
        ? staffUser && body.customerId
          ? Number(body.customerId)
          : auth.user.id
        : null;

    const customerName =
      staffUser && body.customerName
        ? body.customerName.trim()
        : auth.user.name;
    const customerPhone =
      staffUser && body.customerPhone
        ? body.customerPhone.trim()
        : auth.user.phone;
    const customerCompany =
      staffUser && body.customerCompany !== undefined
        ? body.customerCompany.trim()
        : auth.user.companyName;

    const db = await getDb();
    const orderNumber = await generateNextOrderNumber(tradeType);
    const now = new Date().toISOString();

    const initialStatus: OrderStatus =
      tradeType === "PURCHASE"
        ? body.receiveImmediately
          ? "DELIVERED"
          : "PENDING"
        : staffUser
          ? "PROFORMA"
          : "PENDING";

    const initialPayment: PaymentStatus =
      tradeType === "PURCHASE" && body.receiveImmediately ? "PAID" : "UNPAID";

    const orderId = await db.transaction(async (tx) => {
      const orderRes = await tx.run(
        `INSERT INTO orders (
          order_number, trade_type, customer_id, customer_name, customer_phone, customer_company,
          destination_city, delivery_address, status, payment_status, payment_method,
          subtotal_toman, freight_toman, discount_toman, vat_toman, total_toman,
          usd_rate_snapshot, estimated_cost_toman, estimated_profit_toman,
          driver_plate, waybill_number, notes, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', ?, ?, ?, ?)`,
        orderNumber,
        tradeType,
        customerId,
        customerName,
        customerPhone,
        customerCompany,
        destinationCity,
        (body.deliveryAddress ?? "").trim(),
        initialStatus,
        initialPayment,
        (body.paymentMethod ?? "کارت به کارت / نقدی").trim(),
        economics.subtotalToman,
        economics.freightToman,
        economics.discountToman,
        economics.vatToman,
        economics.totalToman,
        config.usdToToman,
        economics.estimatedCostToman,
        economics.estimatedProfitToman,
        (body.notes ?? "").trim(),
        auth.user.name,
        now,
        now
      );

      const newOrderId = Number(orderRes.lastInsertRowid);

      await tx.run(
        `INSERT INTO order_items (
          order_id, product_id, product_name, fuel_type, barrel_liters, density,
          quantity_barrels, total_liters, total_tons, unit_price_barrel_toman, line_total_toman
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        newOrderId,
        product.id,
        product.name,
        product.fuelType,
        product.barrelLiters,
        product.density,
        economics.quantityBarrels,
        economics.totalLiters,
        economics.totalTons,
        unitPricePerBarrel,
        economics.subtotalToman
      );

      if (tradeType === "SALE") {
        await tx.run(
          "UPDATE products SET reserved_barrels = reserved_barrels + ?, updated_at = ? WHERE id = ?",
          economics.quantityBarrels,
          now,
          product.id
        );
      } else {
        if (initialStatus === "DELIVERED") {
          await tx.run(
            "UPDATE products SET stock_barrels = stock_barrels + ?, last_cost_per_barrel_toman = ?, updated_at = ? WHERE id = ?",
            economics.quantityBarrels,
            unitPricePerBarrel,
            now,
            product.id
          );
        } else {
          await tx.run(
            "UPDATE products SET last_cost_per_barrel_toman = ?, updated_at = ? WHERE id = ?",
            unitPricePerBarrel,
            now,
            product.id
          );
        }
      }

      return newOrderId;
    });

    const created = await getOrderById(orderId);
    return NextResponse.json({ ok: true, order: created }, { status: 201 });
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "خطا در ثبت معامله",
      500
    );
  }
}
