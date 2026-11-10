import { normalizeIranPhone } from "./whatsapp-parser.ts";
import type {
  LedgerEntry,
  LedgerSummary,
  Order,
  PartyAccountSummary,
  PartyType,
} from "./types";

/**
 * Canonical identity key so "+98 915 111 2233", "۰۹۱۵۱۱۱۲۲۳۳" and "09151112233"
 * collapse to the same debtor/creditor account.
 */
export function buildPartyKey(name: string, phone: string): string {
  const normPhone = normalizeIranPhone(phone || "");
  if (normPhone.length >= 10) {
    return `phone:${normPhone}`;
  }
  const normName = (name || "").trim().replace(/\s+/g, " ").toLowerCase();
  return `name:${normName || "نامشخص"}`;
}

export function deriveOrderPaidToman(order: {
  totalToman: number;
  paidToman: number;
  paymentStatus: string;
}): number {
  if (order.paidToman > 0) {
    return Math.min(Math.round(order.paidToman), Math.round(order.totalToman));
  }
  if (order.paymentStatus === "PAID") {
    return Math.round(order.totalToman);
  }
  return 0;
}

/**
 * Aggregates receivables (بدهکاران به ما) and payables (بستانکاران از ما) across
 * active sales/purchases and unallocated ledger entries without double counting.
 */
export function computeLedgerSummary(
  orders: Order[],
  entries: LedgerEntry[]
): LedgerSummary {
  const map = new Map<string, PartyAccountSummary>();

  const ensureAccount = (
    key: string,
    partyType: PartyType,
    partyName: string,
    partyPhone: string,
    ts: string
  ): PartyAccountSummary => {
    const existing = map.get(key);
    if (existing) {
      if (ts > existing.lastActivityAt) {
        existing.lastActivityAt = ts;
      }
      if (!existing.partyPhone && partyPhone) {
        existing.partyPhone = partyPhone;
      }
      if (existing.partyType === "OTHER" && partyType !== "OTHER") {
        existing.partyType = partyType;
      }
      return existing;
    }
    const created: PartyAccountSummary = {
      partyKey: key,
      partyType,
      partyName: partyName.trim() || "طرف حساب",
      partyPhone: normalizeIranPhone(partyPhone) || partyPhone.trim(),
      salesCount: 0,
      purchasesCount: 0,
      totalReceivableToman: 0,
      totalPayableToman: 0,
      netBalanceToman: 0,
      lastActivityAt: ts,
    };
    map.set(key, created);
    return created;
  };

  for (const order of orders) {
    if (order.status === "CANCELLED") continue;
    const key = buildPartyKey(order.customerName, order.customerPhone);
    const pType: PartyType = order.tradeType === "SALE" ? "BUYER" : "SELLER";
    const acc = ensureAccount(
      key,
      pType,
      order.customerName,
      order.customerPhone,
      order.updatedAt || order.createdAt
    );

    const paid = deriveOrderPaidToman(order);
    const unpaid = Math.max(Math.round(order.totalToman) - paid, 0);

    if (order.tradeType === "SALE") {
      acc.salesCount += 1;
      acc.totalReceivableToman += unpaid;
      acc.netBalanceToman += unpaid;
    } else {
      acc.purchasesCount += 1;
      acc.totalPayableToman += unpaid;
      acc.netBalanceToman -= unpaid;
    }
  }

  for (const entry of entries) {
    const acc = ensureAccount(
      entry.partyKey,
      entry.partyType,
      entry.partyName,
      entry.partyPhone,
      entry.createdAt
    );

    // Entries with orderId !== null are already reflected in order.paidToman
    if (entry.orderId !== null) continue;

    const amt = Math.max(Math.round(entry.amountToman), 0);
    if (entry.entryType === "DEBIT_RECEIVABLE") {
      acc.totalReceivableToman += amt;
      acc.netBalanceToman += amt;
    } else if (entry.entryType === "CREDIT_PAYABLE") {
      acc.totalPayableToman += amt;
      acc.netBalanceToman -= amt;
    } else if (entry.entryType === "RECEIPT_IN") {
      acc.netBalanceToman -= amt;
    } else if (entry.entryType === "PAYMENT_OUT") {
      acc.netBalanceToman += amt;
    }
  }

  const accounts = Array.from(map.values()).sort((a, b) => {
    const diff = Math.abs(b.netBalanceToman) - Math.abs(a.netBalanceToman);
    if (diff !== 0) return diff;
    return b.lastActivityAt.localeCompare(a.lastActivityAt);
  });

  let totalDebtorsToman = 0;
  let totalCreditorsToman = 0;
  let debtorCount = 0;
  let creditorCount = 0;

  for (const acc of accounts) {
    if (acc.netBalanceToman > 0) {
      totalDebtorsToman += acc.netBalanceToman;
      debtorCount += 1;
    } else if (acc.netBalanceToman < 0) {
      totalCreditorsToman += Math.abs(acc.netBalanceToman);
      creditorCount += 1;
    }
  }

  return {
    accounts,
    entries,
    totalDebtorsToman,
    totalCreditorsToman,
    debtorCount,
    creditorCount,
    netPositionToman: totalDebtorsToman - totalCreditorsToman,
  };
}
