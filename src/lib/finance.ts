import type {
  DateFormatOption,
  Expense,
  Payment,
  Product,
  ProductVariant,
  Purchase,
  Sale,
  SaleItem,
} from "../types/retail";
import { CURRENCY_OPTIONS } from "../types/retail";

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function roundQty(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export function sanitizeDecimalInput(raw: string, maxDecimals = 3): string | null {
  if (raw === "") return "";
  const regex = maxDecimals > 0 ? new RegExp(`^\\d*(?:\\.\\d{0,${maxDecimals}})?$`) : /^\d*$/;
  return regex.test(raw) ? raw : null;
}

export function parsePositiveQty(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num <= 0) return null;
  return roundQty(num);
}

export function getCurrencySymbol(currencyCode: string | undefined): string {
  const found = CURRENCY_OPTIONS.find((c) => c.code === currencyCode);
  return found ? found.symbol : currencyCode || "₹";
}

export function formatCurrency(amount: number, currencyCode = "INR"): string {
  const safe = Number.isFinite(amount) ? roundMoney(amount) : 0;
  const symbol = getCurrencySymbol(currencyCode);
  const absFormatted = Math.abs(safe).toLocaleString(currencyCode === "INR" ? "en-IN" : "en-US", {
    minimumFractionDigits: safe % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return safe < 0 ? `-${symbol}${absFormatted}` : `${symbol}${absFormatted}`;
}

export function formatDateDisplay(isoDate: string, format: DateFormatOption = "DD/MM/YYYY"): string {
  if (!isoDate) return "";
  const datePart = isoDate.slice(0, 10);
  const [y, m, d] = datePart.split("-");
  if (!y || !m || !d) return isoDate;
  if (format === "MM/DD/YYYY") return `${m}/${d}/${y}`;
  if (format === "YYYY-MM-DD") return `${y}-${m}-${d}`;
  return `${d}/${m}/${y}`;
}

export function toLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type DatePreset = "today" | "yesterday" | "last7" | "last30" | "thisMonth" | "custom";

export function resolveDateRange(
  preset: DatePreset,
  customStart?: string,
  customEnd?: string
): { startDate: string; endDate: string; prevStartDate: string; prevEndDate: string } {
  const now = new Date();
  const todayKey = toLocalDateKey(now);

  const shiftDays = (base: Date, days: number): string => {
    const copy = new Date(base);
    copy.setDate(copy.getDate() + days);
    return toLocalDateKey(copy);
  };

  let startDate = todayKey;
  let endDate = todayKey;

  if (preset === "yesterday") {
    startDate = shiftDays(now, -1);
    endDate = startDate;
  } else if (preset === "last7") {
    startDate = shiftDays(now, -6);
    endDate = todayKey;
  } else if (preset === "last30") {
    startDate = shiftDays(now, -29);
    endDate = todayKey;
  } else if (preset === "thisMonth") {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    startDate = toLocalDateKey(first);
    endDate = todayKey;
  } else if (preset === "custom" && customStart && customEnd) {
    startDate = customStart <= customEnd ? customStart : customEnd;
    endDate = customStart <= customEnd ? customEnd : customStart;
  }

  const startObj = new Date(`${startDate}T00:00:00`);
  const endObj = new Date(`${endDate}T00:00:00`);
  const spanDays = Math.max(1, Math.round((endObj.getTime() - startObj.getTime()) / 86400000) + 1);
  const prevEndObj = new Date(startObj);
  prevEndObj.setDate(prevEndObj.getDate() - 1);
  const prevStartObj = new Date(prevEndObj);
  prevStartObj.setDate(prevStartObj.getDate() - (spanDays - 1));

  return {
    startDate,
    endDate,
    prevStartDate: toLocalDateKey(prevStartObj),
    prevEndDate: toLocalDateKey(prevEndObj),
  };
}

export interface ProductPerformance {
  productId: string;
  productName: string;
  unit: string;
  quantitySold: number;
  netRevenue: number;
  cogs: number;
  grossProfit: number;
  currentStock: number;
}

export interface LowStockAlertItem {
  productId: string;
  variantId?: string;
  name: string;
  unit: string;
  currentStock: number;
  minStockLevel: number;
  suggestedReorderQty: number | null;
  avgDailySales: number | null;
  status: "OUT_OF_STOCK" | "LOW_STOCK";
}

export interface ExpiringProductItem {
  productId: string;
  name: string;
  expiryDate: string;
  daysRemaining: number;
  currentStock: number;
  unit: string;
}

export interface FinancialSummary {
  startDate: string;
  endDate: string;
  grossBilledSales: number;
  netSalesRevenue: number;
  taxCollected: number;
  discountsGiven: number;
  refundsTotal: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  operatingExpenses: number;
  estimatedOperatingProfit: number;
  transactionCount: number;
  cashCollected: number;
  upiCollected: number;
  cardCollected: number;
  bankCollected: number;
  creditSales: number;
  customerCreditRepayments: number;
  supplierPaymentsMade: number;
  purchaseValueTotal: number;
  pendingSupplierPayables: number;
  pendingCustomerReceivables: number;
  activeProductCount: number;
  totalStockUnits: number;
  inventoryValuation: number;
  lowStockProducts: LowStockAlertItem[];
  outOfStockCount: number;
  expiringSoonProducts: ExpiringProductItem[];
  bestSellingProducts: ProductPerformance[];
  slowMovingProducts: ProductPerformance[];
  salesTrendDaily: { date: string; netRevenue: number; cogs: number; grossProfit: number; expenses: number; transactions: number }[];
  expenseByCategory: { category: string; amount: number }[];
  paymentMethodBreakdown: { method: string; amount: number }[];
  hasIncompleteCostData: boolean;
}

export function calculateFinancialSummary(params: {
  sales: Sale[];
  saleItems: SaleItem[];
  purchases: Purchase[];
  expenses: Expense[];
  products: Product[];
  variants: ProductVariant[];
  payments: Payment[];
  startDate: string;
  endDate: string;
}): FinancialSummary {
  const { sales, saleItems, purchases, expenses, products, variants, payments, startDate, endDate } = params;

  const inRange = (isoOrDate: string) => {
    const key = isoOrDate.slice(0, 10);
    return key >= startDate && key <= endDate;
  };

  // Active non-cancelled sales in range
  const activeSales = sales.filter((s) => s.status !== "CANCELLED" && inRange(s.transactionDate));
  const activeSaleIds = new Set(activeSales.map((s) => s.id));
  const activeItems = saleItems.filter((item) => activeSaleIds.has(item.saleId));

  let netSalesRevenue = 0;
  let taxCollected = 0;
  let discountsGiven = 0;
  let cogs = 0;
  let grossBilledSales = 0;
  let refundsTotal = 0;

  const productPerfMap = new Map<string, ProductPerformance>();
  const productLookup = new Map(products.map((p) => [p.id, p]));

  for (const s of activeSales) {
    grossBilledSales = roundMoney(grossBilledSales + s.totalAmount);
    refundsTotal = roundMoney(refundsTotal + (s.refundedAmount || 0));
    discountsGiven = roundMoney(discountsGiven + (s.discountAmount || 0));
  }

  for (const item of activeItems) {
    const effectiveQty = Math.max(0, roundQty(item.quantity - (item.returnedQuantity || 0)));
    if (item.quantity <= 0) continue;

    const keepRatio = effectiveQty / item.quantity;
    // Line total includes tax; net sales revenue excludes tax and subtracts line discounts & returns
    const lineGrossBeforeTax = roundMoney(item.unitPrice * item.quantity - item.discountAmount);
    const effectiveNetRev = roundMoney(Math.max(0, lineGrossBeforeTax * keepRatio));
    const effectiveTax = roundMoney((item.taxAmount || 0) * keepRatio);
    const effectiveCogs = roundMoney((item.unitCostSnapshot || 0) * effectiveQty);

    netSalesRevenue = roundMoney(netSalesRevenue + effectiveNetRev);
    taxCollected = roundMoney(taxCollected + effectiveTax);
    cogs = roundMoney(cogs + effectiveCogs);

    const prod = productLookup.get(item.productId);
    const existing = productPerfMap.get(item.productId) || {
      productId: item.productId,
      productName: item.productName,
      unit: item.unit,
      quantitySold: 0,
      netRevenue: 0,
      cogs: 0,
      grossProfit: 0,
      currentStock: prod ? prod.currentStock : 0,
    };
    existing.quantitySold = roundQty(existing.quantitySold + effectiveQty);
    existing.netRevenue = roundMoney(existing.netRevenue + effectiveNetRev);
    existing.cogs = roundMoney(existing.cogs + effectiveCogs);
    existing.grossProfit = roundMoney(existing.netRevenue - existing.cogs);
    productPerfMap.set(item.productId, existing);
  }

  // Account for sale-level discounts beyond item discounts if any
  const itemDiscountSum = activeItems.reduce((acc, it) => acc + (it.discountAmount || 0), 0);
  const headerOnlyDiscount = Math.max(0, roundMoney(discountsGiven - itemDiscountSum));
  if (headerOnlyDiscount > 0) {
    netSalesRevenue = roundMoney(Math.max(0, netSalesRevenue - headerOnlyDiscount));
  }

  const grossProfit = roundMoney(netSalesRevenue - cogs);
  const grossMarginPct = netSalesRevenue > 0 ? roundMoney((grossProfit / netSalesRevenue) * 100) : 0;

  // Operating expenses ONLY (never include inventory purchases)
  const rangeExpenses = expenses.filter((e) => inRange(e.expenseDate));
  const operatingExpenses = roundMoney(rangeExpenses.reduce((acc, e) => acc + e.amount, 0));
  const estimatedOperatingProfit = roundMoney(grossProfit - operatingExpenses);

  // Payment collections breakdown (distinguishing actual collections vs credit sales)
  let cashCollected = 0;
  let upiCollected = 0;
  let cardCollected = 0;
  let bankCollected = 0;
  let creditSales = 0;

  for (const s of activeSales) {
    const netRatio = s.totalAmount > 0 ? Math.max(0, (s.totalAmount - (s.refundedAmount || 0)) / s.totalAmount) : 1;
    if (s.paymentBreakdown) {
      cashCollected = roundMoney(cashCollected + (s.paymentBreakdown.cash || 0) * netRatio);
      upiCollected = roundMoney(upiCollected + (s.paymentBreakdown.upi || 0) * netRatio);
      cardCollected = roundMoney(cardCollected + (s.paymentBreakdown.card || 0) * netRatio);
      bankCollected = roundMoney(bankCollected + (s.paymentBreakdown.bankTransfer || 0) * netRatio);
      creditSales = roundMoney(creditSales + (s.creditAmount || 0));
    } else {
      const netPaid = Math.max(0, roundMoney(s.paidAmount - (s.refundedAmount || 0)));
      if (s.paymentMethod === "CASH") cashCollected = roundMoney(cashCollected + netPaid);
      else if (s.paymentMethod === "UPI") upiCollected = roundMoney(upiCollected + netPaid);
      else if (s.paymentMethod === "CARD") cardCollected = roundMoney(cardCollected + netPaid);
      else if (s.paymentMethod === "BANK_TRANSFER") bankCollected = roundMoney(bankCollected + netPaid);
      creditSales = roundMoney(creditSales + (s.creditAmount || 0));
    }
  }

  const rangePayments = payments.filter((p) => inRange(p.paymentDate));
  const customerCreditRepayments = roundMoney(
    rangePayments.filter((p) => p.partyType === "CUSTOMER").reduce((sum, p) => sum + p.amount, 0)
  );
  const supplierPaymentsMade = roundMoney(
    rangePayments.filter((p) => p.partyType === "SUPPLIER").reduce((sum, p) => sum + p.amount, 0)
  );

  // Purchases (tracked separately from COGS and Operating Expenses)
  const rangePurchases = purchases.filter((p) => p.status !== "CANCELLED" && inRange(p.purchaseDate));
  const purchaseValueTotal = roundMoney(rangePurchases.reduce((sum, p) => sum + p.totalAmount, 0));
  const pendingSupplierPayables = roundMoney(
    purchases
      .filter((p) => p.status !== "CANCELLED" && p.outstandingAmount > 0)
      .reduce((sum, p) => sum + p.outstandingAmount, 0)
  );
  const pendingCustomerReceivables = roundMoney(
    sales
      .filter((s) => s.status !== "CANCELLED" && s.creditAmount > 0)
      .reduce((sum, s) => sum + s.creditAmount, 0)
  );

  // Inventory valuation & low stock alerts (current point-in-time)
  const activeProducts = products.filter((p) => p.isActive);
  const variantsByProduct = new Map<string, ProductVariant[]>();
  for (const v of variants) {
    if (!v.isActive) continue;
    const list = variantsByProduct.get(v.productId) || [];
    list.push(v);
    variantsByProduct.set(v.productId, list);
  }

  let totalStockUnits = 0;
  let inventoryValuation = 0;
  let hasIncompleteCostData = false;

  // Build recent 30-day sales velocity ONLY if at least 7 days of sales history exist
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  const cutoff30 = toLocalDateKey(thirtyDaysAgo);
  const recentNonCancelledSales = sales.filter(
    (s) => s.status !== "CANCELLED" && s.transactionDate.slice(0, 10) >= cutoff30
  );
  const distinctSaleDays = new Set(recentNonCancelledSales.map((s) => s.transactionDate.slice(0, 10))).size;
  const recentSaleIds = new Set(recentNonCancelledSales.map((s) => s.id));
  const soldQty30ByProduct = new Map<string, number>();
  for (const si of saleItems) {
    if (!recentSaleIds.has(si.saleId)) continue;
    const eff = Math.max(0, si.quantity - (si.returnedQuantity || 0));
    soldQty30ByProduct.set(si.productId, (soldQty30ByProduct.get(si.productId) || 0) + eff);
  }

  const lowStockProducts: LowStockAlertItem[] = [];
  let outOfStockCount = 0;
  const expiringSoonProducts: ExpiringProductItem[] = [];
  const todayMs = new Date(`${toLocalDateKey()}T00:00:00`).getTime();

  for (const p of activeProducts) {
    if (p.purchaseCost <= 0) hasIncompleteCostData = true;
    const pVariants = variantsByProduct.get(p.id) || [];

    if (p.hasVariants && pVariants.length > 0) {
      for (const v of pVariants) {
        totalStockUnits = roundQty(totalStockUnits + v.currentStock);
        inventoryValuation = roundMoney(inventoryValuation + v.currentStock * v.purchaseCost);
        if (v.currentStock <= 0) outOfStockCount++;
        if (v.currentStock <= v.minStockLevel) {
          lowStockProducts.push({
            productId: p.id,
            variantId: v.id,
            name: `${p.name} (${v.variantName})`,
            unit: p.unit,
            currentStock: v.currentStock,
            minStockLevel: v.minStockLevel,
            suggestedReorderQty: null,
            avgDailySales: null,
            status: v.currentStock <= 0 ? "OUT_OF_STOCK" : "LOW_STOCK",
          });
        }
      }
    } else {
      totalStockUnits = roundQty(totalStockUnits + p.currentStock);
      inventoryValuation = roundMoney(inventoryValuation + p.currentStock * p.purchaseCost);
      if (p.currentStock <= 0) outOfStockCount++;
      if (p.currentStock <= p.minStockLevel) {
        let suggestedReorderQty: number | null = null;
        let avgDailySales: number | null = null;
        if (distinctSaleDays >= 3 && (soldQty30ByProduct.get(p.id) || 0) > 0) {
          const sold = soldQty30ByProduct.get(p.id) || 0;
          avgDailySales = roundQty(sold / Math.max(distinctSaleDays, 7));
          // Target 14 days cover + safety buffer to minStockLevel
          const target = Math.max(p.minStockLevel * 2, Math.ceil(avgDailySales * 14));
          suggestedReorderQty = Math.max(1, Math.ceil(target - p.currentStock));
        }
        lowStockProducts.push({
          productId: p.id,
          name: p.name,
          unit: p.unit,
          currentStock: p.currentStock,
          minStockLevel: p.minStockLevel,
          suggestedReorderQty,
          avgDailySales,
          status: p.currentStock <= 0 ? "OUT_OF_STOCK" : "LOW_STOCK",
        });
      }
    }

    if (p.expiryDate && p.currentStock > 0) {
      const expMs = new Date(`${p.expiryDate.slice(0, 10)}T00:00:00`).getTime();
      if (Number.isFinite(expMs)) {
        const daysRemaining = Math.ceil((expMs - todayMs) / 86400000);
        if (daysRemaining <= 30) {
          expiringSoonProducts.push({
            productId: p.id,
            name: p.name,
            expiryDate: p.expiryDate.slice(0, 10),
            daysRemaining,
            currentStock: p.currentStock,
            unit: p.unit,
          });
        }
      }
    }
  }

  lowStockProducts.sort((a, b) => a.currentStock - b.currentStock);
  expiringSoonProducts.sort((a, b) => a.daysRemaining - b.daysRemaining);

  const allPerf = Array.from(productPerfMap.values());
  const bestSellingProducts = [...allPerf].sort((a, b) => b.netRevenue - a.netRevenue).slice(0, 10);

  // Slow moving: active products with stock > 0 and lowest sales volume in range
  const slowMovingProducts: ProductPerformance[] = activeProducts
    .filter((p) => p.currentStock > 0)
    .map((p) => {
      const found = productPerfMap.get(p.id);
      return (
        found || {
          productId: p.id,
          productName: p.name,
          unit: p.unit,
          quantitySold: 0,
          netRevenue: 0,
          cogs: 0,
          grossProfit: 0,
          currentStock: p.currentStock,
        }
      );
    })
    .sort((a, b) => a.quantitySold - b.quantitySold || b.currentStock - a.currentStock)
    .slice(0, 10);

  // Daily trend series across [startDate..endDate] (cap at 60 days for readability)
  const dailyMap = new Map<
    string,
    { date: string; netRevenue: number; cogs: number; grossProfit: number; expenses: number; transactions: number }
  >();

  const cur = new Date(`${startDate}T00:00:00`);
  const endObj = new Date(`${endDate}T00:00:00`);
  let guard = 0;
  while (cur <= endObj && guard < 90) {
    const key = toLocalDateKey(cur);
    dailyMap.set(key, { date: key, netRevenue: 0, cogs: 0, grossProfit: 0, expenses: 0, transactions: 0 });
    cur.setDate(cur.getDate() + 1);
    guard++;
  }

  for (const s of activeSales) {
    const key = s.transactionDate.slice(0, 10);
    const bucket = dailyMap.get(key) || {
      date: key,
      netRevenue: 0,
      cogs: 0,
      grossProfit: 0,
      expenses: 0,
      transactions: 0,
    };
    bucket.transactions += 1;
    dailyMap.set(key, bucket);
  }

  for (const item of activeItems) {
    const key = item.transactionDate.slice(0, 10);
    const bucket = dailyMap.get(key);
    if (!bucket || item.quantity <= 0) continue;
    const effectiveQty = Math.max(0, item.quantity - (item.returnedQuantity || 0));
    const keepRatio = effectiveQty / item.quantity;
    const lineNet = Math.max(0, (item.unitPrice * item.quantity - item.discountAmount) * keepRatio);
    const lineCogs = (item.unitCostSnapshot || 0) * effectiveQty;
    bucket.netRevenue = roundMoney(bucket.netRevenue + lineNet);
    bucket.cogs = roundMoney(bucket.cogs + lineCogs);
    bucket.grossProfit = roundMoney(bucket.netRevenue - bucket.cogs);
  }

  for (const exp of rangeExpenses) {
    const key = exp.expenseDate.slice(0, 10);
    const bucket = dailyMap.get(key);
    if (bucket) {
      bucket.expenses = roundMoney(bucket.expenses + exp.amount);
    }
  }

  const salesTrendDaily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  const expCatMap = new Map<string, number>();
  for (const e of rangeExpenses) {
    expCatMap.set(e.category, roundMoney((expCatMap.get(e.category) || 0) + e.amount));
  }
  const expenseByCategory = Array.from(expCatMap.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const paymentMethodBreakdown = [
    { method: "Cash", amount: cashCollected },
    { method: "UPI", amount: upiCollected },
    { method: "Card", amount: cardCollected },
    { method: "Bank Transfer", amount: bankCollected },
    { method: "Credit (Pay Later)", amount: creditSales },
  ].filter((p) => p.amount > 0);

  return {
    startDate,
    endDate,
    grossBilledSales,
    netSalesRevenue,
    taxCollected,
    discountsGiven,
    refundsTotal,
    cogs,
    grossProfit,
    grossMarginPct,
    operatingExpenses,
    estimatedOperatingProfit,
    transactionCount: activeSales.length,
    cashCollected,
    upiCollected,
    cardCollected,
    bankCollected,
    creditSales,
    customerCreditRepayments,
    supplierPaymentsMade,
    purchaseValueTotal,
    pendingSupplierPayables,
    pendingCustomerReceivables,
    activeProductCount: activeProducts.length,
    totalStockUnits,
    inventoryValuation,
    lowStockProducts,
    outOfStockCount,
    expiringSoonProducts,
    bestSellingProducts,
    slowMovingProducts,
    salesTrendDaily,
    expenseByCategory,
    paymentMethodBreakdown,
    hasIncompleteCostData,
  };
}
