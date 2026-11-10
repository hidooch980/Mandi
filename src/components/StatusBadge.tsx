import type { OrderStatus, PaymentStatus } from "@/lib/types";

const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; cls: string }
> = {
  PENDING: {
    label: "در انتظار تایید",
    cls: "bg-amber-100 text-amber-800 border-amber-200",
  },
  PROFORMA: {
    label: "پیش‌فاکتور صادر شده",
    cls: "bg-sky-100 text-sky-800 border-sky-200",
  },
  PAID: {
    label: "تسویه مالی",
    cls: "bg-indigo-100 text-indigo-800 border-indigo-200",
  },
  DISPATCHED: {
    label: "در حال ارسال / بارگیری",
    cls: "bg-purple-100 text-purple-800 border-purple-200",
  },
  DELIVERED: {
    label: "تحویل شده",
    cls: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  CANCELLED: {
    label: "لغو شده",
    cls: "bg-rose-100 text-rose-800 border-rose-200",
  },
};

const PAYMENT_STATUS_META: Record<
  PaymentStatus,
  { label: string; cls: string }
> = {
  UNPAID: {
    label: "تسویه‌نشده",
    cls: "bg-slate-100 text-slate-700 border-slate-200",
  },
  PARTIAL: {
    label: "پیش‌پرداخت",
    cls: "bg-amber-100 text-amber-800 border-amber-200",
  },
  PAID: {
    label: "پرداخت کامل",
    cls: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const meta = ORDER_STATUS_META[status] ?? ORDER_STATUS_META.PENDING;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${meta.cls}`}
    >
      {meta.label}
    </span>
  );
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const meta = PAYMENT_STATUS_META[status] ?? PAYMENT_STATUS_META.UNPAID;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${meta.cls}`}
    >
      {meta.label}
    </span>
  );
}
