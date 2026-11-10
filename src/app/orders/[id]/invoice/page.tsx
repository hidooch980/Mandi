import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { PrintInvoiceButton } from "@/components/PrintInvoiceButton";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/StatusBadge";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import { getMarketConfig, getOrderById } from "@/lib/db";
import { formatJalaliDate, formatNumberFa, formatUsd } from "@/lib/jalali";
import { FUEL_LABELS } from "@/lib/pricing-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const order = await getOrderById(Number(id));
  if (!order) notFound();

  const staff = isStaffRole(user.role);
  if (!staff && order.customerId !== user.id) {
    redirect("/portal");
  }

  const config = await getMarketConfig();
  const totalUsd = order.totalToman / Math.max(order.usdRateSnapshot, 1);
  const isPurchase = order.tradeType === "PURCHASE";

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <Link
            href={staff ? "/orders" : "/portal"}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-900"
          >
            <ArrowRight className="w-4 h-4" />
            بازگشت
          </Link>
          <PrintInvoiceButton />
        </div>

        <div className="print-sheet rounded-2xl bg-white border border-slate-200 shadow-lg p-6 sm:p-10 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between gap-4 border-b-2 border-slate-900 pb-5">
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">
                {isPurchase
                  ? "سند خرید و رسید ورود سوخت بشکه‌ای به انبار"
                  : "پیش‌فاکتور / صورت‌حساب فروش بنزین و گازوئیل بشکه‌ای"}
              </h1>
              <p className="text-sm font-bold text-emerald-700 mt-1">
                {config.companyTitle}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {config.companyAddress} | تلفن: {config.companyPhone}
              </p>
              {config.companyEconomicCode && (
                <p className="text-xs text-slate-500 tabular-nums">
                  شناسه / کد اقتصادی: {config.companyEconomicCode}
                </p>
              )}
            </div>

            <div className="text-xs space-y-1.5 sm:text-left">
              <div className="font-extrabold text-sm text-slate-900 tabular-nums">
                شماره سند: {order.orderNumber}
              </div>
              <div className="text-slate-600 tabular-nums">
                تاریخ صدور: {formatJalaliDate(order.createdAt, true)}
              </div>
              <div className="flex sm:justify-end gap-1.5 pt-1">
                <OrderStatusBadge status={order.status} />
                <PaymentStatusBadge status={order.paymentStatus} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="space-y-1">
              <div className="font-bold text-slate-900 mb-1">
                {isPurchase ? "مشخصات فروشنده / تامین‌کننده" : "مشخصات خریدار"}
              </div>
              <div>نام: {order.customerName}</div>
              <div>شرکت / مجموعه: {order.customerCompany || "شخصی"}</div>
              <div>شماره تماس: {order.customerPhone}</div>
            </div>
            <div className="space-y-1">
              <div className="font-bold text-slate-900 mb-1">مشخصات حمل و تحویل</div>
              <div>شهر: {order.destinationCity}</div>
              <div>نشانی: {order.deliveryAddress || "تحویل درب انبار / هماهنگی تلفنی"}</div>
              <div>
                پلاک / بارنامه: {order.driverPlate || "—"} | {order.waybillNumber || "—"}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right border border-slate-300">
              <thead className="bg-slate-900 text-white">
                <tr>
                  <th className="py-2.5 px-3">ردیف</th>
                  <th className="py-2.5 px-3">فرآورده و شرح بشکه</th>
                  <th className="py-2.5 px-3">تعداد بشکه</th>
                  <th className="py-2.5 px-3">حجم کل (لیتر)</th>
                  <th className="py-2.5 px-3">وزن برآوردی (تن)</th>
                  <th className="py-2.5 px-3">فی هر بشکه (تومان)</th>
                  <th className="py-2.5 px-3">مبلغ کل (تومان)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {order.items.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="py-3 px-3 tabular-nums">{formatNumberFa(idx + 1)}</td>
                    <td className="py-3 px-3 font-semibold text-slate-900">
                      [{FUEL_LABELS[item.fuelType]}] {item.productName}
                      <div className="text-[11px] text-slate-500">
                        بشکه {formatNumberFa(item.barrelLiters)} لیتری • چگالی {item.density}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-bold tabular-nums">
                      {formatNumberFa(item.quantityBarrels)} بشکه
                    </td>
                    <td className="py-3 px-3 tabular-nums">
                      {formatNumberFa(item.totalLiters)} لیتر
                    </td>
                    <td className="py-3 px-3 tabular-nums">
                      {formatNumberFa(item.totalTons, 3)} تن
                    </td>
                    <td className="py-3 px-3 tabular-nums">
                      {formatNumberFa(item.unitPriceBarrelToman)}
                    </td>
                    <td className="py-3 px-3 font-bold tabular-nums">
                      {formatNumberFa(item.lineTotalToman)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
            <div className="text-xs text-slate-600 space-y-1.5 border border-slate-200 rounded-xl p-4">
              <div className="font-bold text-slate-900">شرایط و توضیحات:</div>
              <p>۱. اعتبار این سند ۲۴ ساعت است و تحویل منوط به تسویه و تایید بارنامه می‌باشد.</p>
              <p>۲. تمام بشکه‌ها با پلمپ استاندارد و تطابق حجمی تحویل می‌گردند.</p>
              <p>۳. روش تسویه: <strong>{order.paymentMethod}</strong></p>
              {order.notes && <p>توضیحات تکمیلی: {order.notes}</p>}
            </div>

            <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 space-y-2 text-xs tabular-nums">
              <div className="flex justify-between">
                <span className="text-slate-600">جمع مبلغ کالا:</span>
                <span className="font-bold">{formatNumberFa(order.subtotalToman)} تومان</span>
              </div>
              {order.discountToman > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>تخفیف حجمی:</span>
                  <span className="font-bold">-{formatNumberFa(order.discountToman)} تومان</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-600">هزینه حمل و لجستیک:</span>
                <span className="font-bold">+{formatNumberFa(order.freightToman)} تومان</span>
              </div>
              {order.vatToman > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">مالیات بر ارزش افزوده:</span>
                  <span className="font-bold">+{formatNumberFa(order.vatToman)} تومان</span>
                </div>
              )}
              <div className="border-t border-slate-300 pt-2.5 flex justify-between text-sm font-extrabold text-slate-900">
                <span>مبلغ نهایی سند:</span>
                <span>{formatNumberFa(order.totalToman)} تومان</span>
              </div>
              {(() => {
                const paidAmt =
                  order.paidToman > 0
                    ? order.paidToman
                    : order.paymentStatus === "PAID"
                      ? order.totalToman
                      : 0;
                const remAmt = Math.max(order.totalToman - paidAmt, 0);
                return (
                  <>
                    <div className="flex justify-between text-xs text-emerald-700">
                      <span>مبلغ پرداخت‌شده:</span>
                      <span className="font-bold">{formatNumberFa(paidAmt)} تومان</span>
                    </div>
                    {remAmt > 0 && (
                      <div className="flex justify-between text-xs text-rose-700 font-bold">
                        <span>مانده تسویه‌نشده:</span>
                        <span>{formatNumberFa(remAmt)} تومان</span>
                      </div>
                    )}
                  </>
                );
              })()}
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>معادل ارزی (دلار {formatNumberFa(order.usdRateSnapshot)} ت):</span>
                <span className="font-bold">{formatUsd(totalUsd)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 pt-8 text-xs text-center text-slate-600">
            <div className="border-t border-dashed border-slate-300 pt-3">
              مهر و امضای {config.companyTitle}
            </div>
            <div className="border-t border-dashed border-slate-300 pt-3">
              تایید و امضای {order.customerName}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
