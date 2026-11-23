import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Circle,
  Package,
  Plus,
  ShoppingBag,
  Truck,
  Wallet,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useStore } from "../context/StoreContext";
import {
  calculateFinancialSummary,
  formatCurrency,
  formatDateDisplay,
  getCurrencySymbol,
  resolveDateRange,
  roundMoney,
  toLocalDateKey,
  type DatePreset,
} from "../lib/finance";
import { t } from "../lib/i18n";
import { Button, InfoTip, TextInput } from "../components/ui/Primitives";

export function OverviewPage() {
  const {
    activeBusiness,
    userRole,
    products,
    variants,
    sales,
    saleItems,
    purchases,
    expenses,
    payments,
    auditLogs,
    setActiveTab,
  } = useStore();

  const [preset, setPreset] = useState<DatePreset>("today");
  const [customStart, setCustomStart] = useState(toLocalDateKey());
  const [customEnd, setCustomEnd] = useState(toLocalDateKey());

  const lang = activeBusiness?.language || "en";
  const currency = activeBusiness?.currency || "INR";

  const { startDate, endDate, prevStartDate, prevEndDate } = useMemo(
    () => resolveDateRange(preset, customStart, customEnd),
    [preset, customStart, customEnd]
  );

  const current = useMemo(
    () =>
      calculateFinancialSummary({
        sales,
        saleItems,
        purchases,
        expenses,
        products,
        variants,
        payments,
        startDate,
        endDate,
      }),
    [sales, saleItems, purchases, expenses, products, variants, payments, startDate, endDate]
  );

  const previous = useMemo(
    () =>
      calculateFinancialSummary({
        sales,
        saleItems,
        purchases,
        expenses,
        products,
        variants,
        payments,
        startDate: prevStartDate,
        endDate: prevEndDate,
      }),
    [sales, saleItems, purchases, expenses, products, variants, payments, prevStartDate, prevEndDate]
  );

  const salesDeltaPct = useMemo(() => {
    if (previous.netSalesRevenue <= 0) return null;
    return Math.round(((current.netSalesRevenue - previous.netSalesRevenue) / previous.netSalesRevenue) * 100);
  }, [current.netSalesRevenue, previous.netSalesRevenue]);

  // 7-day or selected trend chart
  const chartRange = useMemo(() => {
    if (preset === "today" || preset === "yesterday") {
      return resolveDateRange("last7");
    }
    return { startDate, endDate };
  }, [preset, startDate, endDate]);

  const trendSummary = useMemo(
    () =>
      calculateFinancialSummary({
        sales,
        saleItems,
        purchases,
        expenses,
        products,
        variants,
        payments,
        startDate: chartRange.startDate,
        endDate: chartRange.endDate,
      }),
    [sales, saleItems, purchases, expenses, products, variants, payments, chartRange]
  );

  const [topProductMode, setTopProductMode] = useState<"revenue" | "profit">("revenue");

  const todayRange = useMemo(() => resolveDateRange("today"), []);
  const weekRange = useMemo(() => resolveDateRange("last7"), []);
  const monthRange = useMemo(() => resolveDateRange("thisMonth"), []);

  const todaySummary = useMemo(
    () =>
      calculateFinancialSummary({
        sales,
        saleItems,
        purchases,
        expenses,
        products,
        variants,
        payments,
        startDate: todayRange.startDate,
        endDate: todayRange.endDate,
      }),
    [sales, saleItems, purchases, expenses, products, variants, payments, todayRange]
  );

  const weekSummary = useMemo(
    () =>
      calculateFinancialSummary({
        sales,
        saleItems,
        purchases,
        expenses,
        products,
        variants,
        payments,
        startDate: weekRange.startDate,
        endDate: weekRange.endDate,
      }),
    [sales, saleItems, purchases, expenses, products, variants, payments, weekRange]
  );

  const monthSummary = useMemo(
    () =>
      calculateFinancialSummary({
        sales,
        saleItems,
        purchases,
        expenses,
        products,
        variants,
        payments,
        startDate: monthRange.startDate,
        endDate: monthRange.endDate,
      }),
    [sales, saleItems, purchases, expenses, products, variants, payments, monthRange]
  );

  const netMarginPct = useMemo(() => {
    if (current.netSalesRevenue <= 0) return 0;
    return roundMoney((current.estimatedOperatingProfit / current.netSalesRevenue) * 100);
  }, [current.estimatedOperatingProfit, current.netSalesRevenue]);

  const cogsPct = useMemo(() => {
    if (current.netSalesRevenue <= 0) return 0;
    return roundMoney((current.cogs / current.netSalesRevenue) * 100);
  }, [current.cogs, current.netSalesRevenue]);

  const expensePct = useMemo(() => {
    if (current.netSalesRevenue <= 0) return 0;
    return roundMoney((current.operatingExpenses / current.netSalesRevenue) * 100);
  }, [current.operatingExpenses, current.netSalesRevenue]);

  const realizedCollectionsTotal = useMemo(
    () =>
      roundMoney(
        current.cashCollected +
          current.upiCollected +
          current.cardCollected +
          current.bankCollected +
          current.customerCreditRepayments
      ),
    [
      current.cashCollected,
      current.upiCollected,
      current.cardCollected,
      current.bankCollected,
      current.customerCreditRepayments,
    ]
  );

  const topProductsDisplayed = useMemo(() => {
    const list = [...current.bestSellingProducts];
    if (topProductMode === "profit") {
      list.sort((a, b) => b.grossProfit - a.grossProfit);
    } else {
      list.sort((a, b) => b.netRevenue - a.netRevenue);
    }
    return list.slice(0, 5);
  }, [current.bestSellingProducts, topProductMode]);

  const isBrandNewStore = products.length === 0 && sales.length === 0 && purchases.length === 0;
  const hasProducts = products.length > 0;
  const hasOpeningOrPurchase = products.some((p) => p.currentStock > 0) || purchases.length > 0;
  const hasSale = sales.length > 0;

  const recentSales = useMemo(
    () => [...sales].sort((a, b) => b.transactionDate.localeCompare(a.transactionDate)).slice(0, 6),
    [sales]
  );

  const datePresets: Array<{ id: DatePreset; label: string }> = [
    { id: "today", label: t(lang, "today") },
    { id: "yesterday", label: t(lang, "yesterday") },
    { id: "last7", label: t(lang, "last7Days") },
    { id: "last30", label: t(lang, "last30Days") },
    { id: "thisMonth", label: t(lang, "thisMonth") },
    { id: "custom", label: t(lang, "customRange") },
  ];

  return (
    <div className="space-y-6">
      {/* Top Toolbar: Greeting + Date Range + Quick Actions */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#17263C]">{activeBusiness?.name}</h2>
          <p className="text-xs text-[#758195] mt-0.5">
            {formatDateDisplay(startDate, activeBusiness?.dateFormat)}
            {startDate !== endDate ? ` – ${formatDateDisplay(endDate, activeBusiness?.dateFormat)}` : ""}
            {" · "}
            {activeBusiness?.category}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="accent" size="sm" onClick={() => setActiveTab("sales")}>
            <ShoppingBag className="w-4 h-4" />
            {t(lang, "newSale")}
          </Button>
          {userRole !== "CASHIER" && (
            <>
              <Button variant="secondary" size="sm" onClick={() => setActiveTab("products")}>
                <Plus className="w-4 h-4" />
                {t(lang, "addProduct")}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setActiveTab("purchases")}>
                <Truck className="w-4 h-4" />
                {t(lang, "recordPurchase")}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setActiveTab("expenses")}>
                <Wallet className="w-4 h-4" />
                {t(lang, "addExpense")}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-white border border-[#E6EAE9] rounded-lg">
          {datePresets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                preset === p.id
                  ? "bg-[#17263C] text-white"
                  : "text-[#758195] hover:text-[#17263C]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <TextInput
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="!w-auto !min-h-[38px] text-xs"
            />
            <span className="text-xs text-[#758195]">to</span>
            <TextInput
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="!w-auto !min-h-[38px] text-xs"
            />
          </div>
        )}
      </div>

      {/* First-Time Guided Setup (shown until initial setup steps are done) */}
      {(!hasProducts || !hasSale) && (
        <div className="bg-white border border-[#E6EAE9] rounded-xl p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E6EAE9]">
            <div>
              <h3 className="text-sm font-semibold text-[#17263C]">
                {isBrandNewStore ? "Welcome to RetailMate — Let's get your shop ready" : "Finish your quick store setup"}
              </h3>
              <p className="text-xs text-[#758195] mt-0.5">
                You can explore any screen freely. Complete these steps whenever you are ready:
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            <button
              type="button"
              onClick={() => setActiveTab("products")}
              className="flex items-start gap-3 p-3.5 rounded-lg border border-[#E6EAE9] hover:border-[#147D75] text-left transition-colors cursor-pointer"
            >
              {hasProducts ? (
                <CheckCircle2 className="w-5 h-5 text-[#21865B] shrink-0 mt-0.5" />
              ) : (
                <Circle className="w-5 h-5 text-[#758195] shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-xs font-semibold text-[#17263C]">1. Add your first product</p>
                <p className="text-[11px] text-[#758195] mt-0.5">Enter item name, selling price, and opening stock.</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("purchases")}
              className="flex items-start gap-3 p-3.5 rounded-lg border border-[#E6EAE9] hover:border-[#147D75] text-left transition-colors cursor-pointer"
            >
              {hasOpeningOrPurchase ? (
                <CheckCircle2 className="w-5 h-5 text-[#21865B] shrink-0 mt-0.5" />
              ) : (
                <Circle className="w-5 h-5 text-[#758195] shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-xs font-semibold text-[#17263C]">2. Record opening stock or purchase</p>
                <p className="text-[11px] text-[#758195] mt-0.5">Track supplier bills and stock received.</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("sales")}
              className="flex items-start gap-3 p-3.5 rounded-lg border border-[#E6EAE9] hover:border-[#147D75] text-left transition-colors cursor-pointer"
            >
              {hasSale ? (
                <CheckCircle2 className="w-5 h-5 text-[#21865B] shrink-0 mt-0.5" />
              ) : (
                <Circle className="w-5 h-5 text-[#758195] shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-xs font-semibold text-[#17263C]">3. Record your first sale</p>
                <p className="text-[11px] text-[#758195] mt-0.5">Generate a receipt and watch stock update automatically.</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* 5 Core Questions Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* 1. Net Sales Revenue */}
        <div className="bg-white border border-[#E6EAE9] rounded-xl p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#758195]">{t(lang, "qSoldToday")}</span>
            <InfoTip text="Net sales revenue excluding tax, after discounts and customer returns." />
          </div>
          <p className="text-2xl font-bold font-mono-num text-[#17263C] mt-2">
            {formatCurrency(current.netSalesRevenue, currency)}
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs text-[#758195]">
            <span className="font-mono-num">{current.transactionCount} sale(s)</span>
            {salesDeltaPct !== null && (
              <>
                <span>·</span>
                <span
                  className={`inline-flex items-center gap-0.5 font-mono-num font-medium ${
                    salesDeltaPct >= 0 ? "text-[#21865B]" : "text-[#C84C4C]"
                  }`}
                >
                  {salesDeltaPct >= 0 ? (
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5" />
                  )}
                  {salesDeltaPct >= 0 ? `+${salesDeltaPct}%` : `${salesDeltaPct}%`} vs prior
                </span>
              </>
            )}
          </div>
        </div>

        {/* 2. Estimated Gross Profit */}
        <div className="bg-white border border-[#E6EAE9] rounded-xl p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#758195]">{t(lang, "qGrossProfit")}</span>
            <InfoTip text="Sales revenue minus the cost of the items you sold (COGS). Not final net profit until shop expenses are subtracted." />
          </div>
          <p className="text-2xl font-bold font-mono-num text-[#147D75] mt-2">
            {formatCurrency(current.grossProfit, currency)}
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs text-[#758195]">
            <span className="font-mono-num">Margin {current.grossMarginPct}%</span>
            <span>·</span>
            <span className="font-mono-num">Item cost {formatCurrency(current.cogs, currency)}</span>
          </div>
        </div>

        {/* 3. Operating Expenses & Est. Operating Profit */}
        <div className="bg-white border border-[#E6EAE9] rounded-xl p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#758195]">{t(lang, "qOperatingProfit")}</span>
            <InfoTip text="Gross profit minus shop expenses (rent, wages, electricity). Product purchases are not double-counted here." />
          </div>
          <p
            className={`text-2xl font-bold font-mono-num mt-2 ${
              current.estimatedOperatingProfit >= 0 ? "text-[#17263C]" : "text-[#C84C4C]"
            }`}
          >
            {formatCurrency(current.estimatedOperatingProfit, currency)}
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs text-[#758195]">
            <span>Expenses:</span>
            <span className="font-mono-num text-[#17263C]">
              {formatCurrency(current.operatingExpenses, currency)}
            </span>
          </div>
        </div>

        {/* 4. Stock on Hand & Attention */}
        <div className="bg-white border border-[#E6EAE9] rounded-xl p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#758195]">{t(lang, "qStockValue")}</span>
            <InfoTip text="Total purchase cost value of products currently on your shelves across all active items." />
          </div>
          <p className="text-2xl font-bold font-mono-num text-[#17263C] mt-2">
            {formatCurrency(current.inventoryValuation, currency)}
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs text-[#758195]">
            <span className="font-mono-num">{current.activeProductCount} active items</span>
            <span>·</span>
            <span
              className={`font-medium ${
                current.lowStockProducts.length > 0 ? "text-[#D99A31]" : "text-[#21865B]"
              }`}
            >
              {current.lowStockProducts.length} low stock
            </span>
          </div>
        </div>
      </div>

      {/* Earnings & Profit Clarity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Profit Breakdown Waterfall */}
        <div className="lg:col-span-7 bg-white border border-[#E6EAE9] rounded-xl p-5 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[#17263C]">
                Earnings & Profit Breakdown
              </h3>
              <p className="text-xs text-[#758195] mt-0.5">
                Clear step-by-step calculation from sales revenue to estimated net shop profit
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("reports")}
              className="text-xs font-medium text-[#147D75] hover:underline cursor-pointer shrink-0"
            >
              Full Profit Report
            </button>
          </div>

          <div className="divide-y divide-[#E6EAE9] text-xs">
            <div className="py-2.5 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-[#17263C]">Net Sales Revenue</p>
                <p className="text-[11px] text-[#758195]">
                  Excludes {formatCurrency(current.taxCollected, currency)} tax · after{" "}
                  {formatCurrency(current.discountsGiven + current.refundsTotal, currency)} discounts & returns
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono-num font-semibold text-[#17263C]">
                  {formatCurrency(current.netSalesRevenue, currency)}
                </p>
                <p className="text-[11px] font-mono-num text-[#758195]">100%</p>
              </div>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-[#17263C]">− Cost of Items Sold (COGS)</p>
                <p className="text-[11px] text-[#758195]">
                  Purchase cost of the actual units sold in this period
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono-num font-semibold text-[#17263C]">
                  −{formatCurrency(current.cogs, currency)}
                </p>
                <p className="text-[11px] font-mono-num text-[#758195]">{cogsPct}% of sales</p>
              </div>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-3 bg-[#F7F8F6] px-3 rounded-lg">
              <div>
                <p className="font-semibold text-[#147D75]">= Estimated Gross Profit</p>
                <p className="text-[11px] text-[#758195]">Earnings left before shop expenses</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono-num font-bold text-[#147D75]">
                  {formatCurrency(current.grossProfit, currency)}
                </p>
                <p className="text-[11px] font-mono-num text-[#147D75]">
                  {current.grossMarginPct}% gross margin
                </p>
              </div>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-[#17263C]">− Shop Operating Expenses</p>
                <p className="text-[11px] text-[#758195]">
                  Rent, staff pay, electricity & overheads (stock bills excluded)
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono-num font-semibold text-[#D99A31]">
                  −{formatCurrency(current.operatingExpenses, currency)}
                </p>
                <p className="text-[11px] font-mono-num text-[#758195]">{expensePct}% of sales</p>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[#17263C]">= Estimated Net Operating Profit</p>
                <p className="text-[11px] text-[#758195]">
                  {current.netSalesRevenue > 0
                    ? `Out of every ${getCurrencySymbol(currency)}100 sold, ${getCurrencySymbol(currency)}${Math.max(0, netMarginPct).toFixed(1)} stays as operating profit`
                    : "Record sales to see your net margin per 100 sold"}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p
                  className={`text-lg font-mono-num font-bold ${
                    current.estimatedOperatingProfit >= 0 ? "text-[#21865B]" : "text-[#C84C4C]"
                  }`}
                >
                  {formatCurrency(current.estimatedOperatingProfit, currency)}
                </p>
                <p
                  className={`text-[11px] font-mono-num font-medium ${
                    netMarginPct >= 0 ? "text-[#21865B]" : "text-[#C84C4C]"
                  }`}
                >
                  {netMarginPct}% net margin
                </p>
              </div>
            </div>
          </div>

          {/* Visual Proportion Split Bar */}
          {current.netSalesRevenue > 0 && (
            <div className="space-y-2 pt-1">
              <div className="h-2.5 w-full rounded-md overflow-hidden bg-[#F7F8F6] flex border border-[#E6EAE9]">
                <div
                  style={{ width: `${Math.min(100, Math.max(0, cogsPct))}%` }}
                  className="bg-[#17263C]"
                  title={`Item Cost: ${cogsPct}%`}
                />
                <div
                  style={{
                    width: `${Math.min(Math.max(0, 100 - cogsPct), Math.max(0, expensePct))}%`,
                  }}
                  className="bg-[#D99A31]"
                  title={`Expenses: ${expensePct}%`}
                />
                {netMarginPct > 0 && (
                  <div
                    style={{ width: `${Math.min(100, netMarginPct)}%` }}
                    className="bg-[#147D75]"
                    title={`Net Profit: ${netMarginPct}%`}
                  />
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#758195]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-xs bg-[#17263C]" />
                  Item Cost ({cogsPct}%)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-xs bg-[#D99A31]" />
                  Shop Expenses ({expensePct}%)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-xs bg-[#147D75]" />
                  Net Profit ({netMarginPct}%)
                </span>
              </div>
            </div>
          )}

          {current.hasIncompleteCostData && (
            <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-[#D99A31]/10 text-[11px] text-[#17263C]">
              <span>
                Some active products have zero buy cost — add purchase costs for exact profit calculation.
              </span>
              <button
                type="button"
                onClick={() => setActiveTab("products")}
                className="font-semibold text-[#147D75] hover:underline shrink-0 cursor-pointer"
              >
                Update Costs
              </button>
            </div>
          )}
        </div>

        {/* Multi-Period Profit Comparison + Realized Cash */}
        <div className="lg:col-span-5 bg-white border border-[#E6EAE9] rounded-xl p-5 flex flex-col justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-[#17263C]">
              Profit Across Periods
            </h3>
            <p className="text-xs text-[#758195] mt-0.5">
              Compare today, last 7 days, and this month at a glance
            </p>

            <div className="mt-3 border border-[#E6EAE9] rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F7F8F6] border-b border-[#E6EAE9] text-[11px] font-semibold text-[#758195]">
                    <th className="py-2 px-3">Period</th>
                    <th className="py-2 px-2 text-right">Sales</th>
                    <th className="py-2 px-2 text-right">Expenses</th>
                    <th className="py-2 px-3 text-right">Net Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6EAE9]">
                  {[
                    { id: "today" as DatePreset, label: "Today", data: todaySummary },
                    { id: "last7" as DatePreset, label: "Last 7 Days", data: weekSummary },
                    { id: "thisMonth" as DatePreset, label: "This Month", data: monthSummary },
                  ].map((row) => {
                    const rowMargin =
                      row.data.netSalesRevenue > 0
                        ? roundMoney((row.data.estimatedOperatingProfit / row.data.netSalesRevenue) * 100)
                        : 0;
                    const isSelected = preset === row.id;
                    return (
                      <tr
                        key={row.id}
                        onClick={() => setPreset(row.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? "bg-[#147D75]/5" : "hover:bg-[#F7F8F6]/70"
                        }`}
                      >
                        <td className="py-2.5 px-3 font-medium text-[#17263C]">
                          {row.label}
                          <span className="block text-[10px] text-[#758195] font-mono-num">
                            {row.data.transactionCount} sale(s)
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono-num text-[#17263C]">
                          {formatCurrency(row.data.netSalesRevenue, currency)}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono-num text-[#758195]">
                          {formatCurrency(row.data.operatingExpenses, currency)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-num">
                          <span
                            className={`font-semibold ${
                              row.data.estimatedOperatingProfit >= 0 ? "text-[#21865B]" : "text-[#C84C4C]"
                            }`}
                          >
                            {formatCurrency(row.data.estimatedOperatingProfit, currency)}
                          </span>
                          <span className="block text-[10px] text-[#758195]">
                            {rowMargin}% margin
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Money Received vs Uncollected & Stock Purchases */}
          <div className="pt-3 border-t border-[#E6EAE9] grid grid-cols-3 gap-3 text-xs">
            <div className="p-2.5 rounded-lg bg-[#F7F8F6]">
              <p className="text-[10px] text-[#758195]">Cash/UPI Received</p>
              <p className="font-mono-num font-bold text-[#21865B] mt-0.5">
                {formatCurrency(realizedCollectionsTotal, currency)}
              </p>
              <p className="text-[10px] text-[#758195]">Incl. dues paid</p>
            </div>
            <div className="p-2.5 rounded-lg bg-[#F7F8F6]">
              <p className="text-[10px] text-[#758195]">Pending Credit</p>
              <p className="font-mono-num font-bold text-[#D99A31] mt-0.5">
                {formatCurrency(current.creditSales, currency)}
              </p>
              <p className="text-[10px] text-[#758195]">From period sales</p>
            </div>
            <div className="p-2.5 rounded-lg bg-[#F7F8F6]">
              <p className="text-[10px] text-[#758195]">Stock Purchased</p>
              <p className="font-mono-num font-bold text-[#17263C] mt-0.5">
                {formatCurrency(current.purchaseValueTotal, currency)}
              </p>
              <p className="text-[10px] text-[#758195]">Tracked separately</p>
            </div>
          </div>
        </div>
      </div>

      {/* Collections Breakdown Strip */}
      <div className="bg-white border border-[#E6EAE9] rounded-xl p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div>
          <p className="text-[11px] text-[#758195]">Cash Collected</p>
          <p className="text-sm font-semibold font-mono-num text-[#17263C] mt-1">
            {formatCurrency(current.cashCollected, currency)}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-[#758195]">UPI Collected</p>
          <p className="text-sm font-semibold font-mono-num text-[#17263C] mt-1">
            {formatCurrency(current.upiCollected, currency)}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-[#758195]">Card & Bank</p>
          <p className="text-sm font-semibold font-mono-num text-[#17263C] mt-1">
            {formatCurrency(current.cardCollected + current.bankCollected, currency)}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-[#758195]">Credit Sales (Pay Later)</p>
          <p className="text-sm font-semibold font-mono-num text-[#D99A31] mt-1">
            {formatCurrency(current.creditSales, currency)}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-[#758195]">Customer Dues Open</p>
          <p className="text-sm font-semibold font-mono-num text-[#17263C] mt-1">
            {formatCurrency(current.pendingCustomerReceivables, currency)}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-[#758195]">Supplier Dues Open</p>
          <p className="text-sm font-semibold font-mono-num text-[#C84C4C] mt-1">
            {formatCurrency(current.pendingSupplierPayables, currency)}
          </p>
        </div>
      </div>

      {/* Main Chart + Attention List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Trend Chart */}
        <div className="lg:col-span-2 bg-white border border-[#E6EAE9] rounded-xl p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[#17263C]">
                Sales & Gross Profit Trend
              </h3>
              <p className="text-xs text-[#758195]">
                {preset === "today" || preset === "yesterday" ? "Last 7 days daily view" : "Selected period daily breakdown"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("reports")}
              className="text-xs font-medium text-[#147D75] hover:underline cursor-pointer"
            >
              Open Full Reports
            </button>
          </div>

          {trendSummary.salesTrendDaily.every((d) => d.netRevenue === 0) ? (
            <div className="h-60 flex flex-col items-center justify-center text-center border border-dashed border-[#E6EAE9] rounded-lg p-6">
              <p className="text-sm font-medium text-[#17263C]">No sales recorded in this period yet</p>
              <p className="text-xs text-[#758195] mt-1">
                Record your first sale to see daily sales and gross profit trends here.
              </p>
              <Button variant="accent" size="sm" className="mt-4" onClick={() => setActiveTab("sales")}>
                Record a Sale
              </Button>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendSummary.salesTrendDaily} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6EAE9" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v: string) => v.slice(5)}
                    tick={{ fontSize: 11, fill: "#758195" }}
                    axisLine={{ stroke: "#E6EAE9" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#758195" }}
                    axisLine={false}
                    tickLine={false}
                    width={54}
                  />
                  <Tooltip
                    formatter={(val: unknown) => formatCurrency(Number(val || 0), currency)}
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      borderColor: "#E6EAE9",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="netRevenue"
                    name="Net Sales"
                    stroke="#17263C"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#17263C" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="grossProfit"
                    name="Est. Gross Profit"
                    stroke="#147D75"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#147D75" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Products Needing Attention */}
        <div className="bg-white border border-[#E6EAE9] rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#E6EAE9]">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#D99A31]" />
              <h3 className="text-sm font-semibold text-[#17263C]">{t(lang, "qAttention")}</h3>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("products")}
              className="text-xs font-medium text-[#147D75] hover:underline cursor-pointer"
            >
              Manage Stock
            </button>
          </div>

          <div className="flex-1 divide-y divide-[#E6EAE9] mt-1">
            {current.lowStockProducts.length === 0 && current.expiringSoonProducts.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#758195]">
                All stocked products are above their minimum reorder levels.
              </div>
            ) : (
              <>
                {current.lowStockProducts.slice(0, 5).map((item) => (
                  <div
                    key={`${item.productId}_${item.variantId || "base"}`}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#17263C] truncate">{item.name}</p>
                      <p className="text-[11px] text-[#758195] mt-0.5">
                        Min {item.minStockLevel} {item.unit}
                        {item.suggestedReorderQty !== null
                          ? ` · Suggest order +${item.suggestedReorderQty}`
                          : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`text-xs font-mono-num font-semibold ${
                          item.status === "OUT_OF_STOCK" ? "text-[#C84C4C]" : "text-[#D99A31]"
                        }`}
                      >
                        {item.currentStock} {item.unit}
                      </span>
                      <p className="text-[10px] text-[#758195]">
                        {item.status === "OUT_OF_STOCK" ? "Out of stock" : "Low stock"}
                      </p>
                    </div>
                  </div>
                ))}
                {current.expiringSoonProducts.slice(0, 2).map((exp) => (
                  <div key={exp.productId} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#17263C] truncate">{exp.name}</p>
                      <p className="text-[11px] text-[#D99A31]">
                        {exp.daysRemaining <= 0
                          ? "Expired"
                          : `Expires in ${exp.daysRemaining} day(s)`}
                      </p>
                    </div>
                    <span className="text-xs font-mono-num text-[#758195] shrink-0">
                      {exp.currentStock} {exp.unit}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom 3 Columns: Best Sellers, Recent Sales, Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Best-Selling & Most Profitable Products */}
        <div className="bg-white border border-[#E6EAE9] rounded-xl p-5">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#E6EAE9]">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-[#758195]" />
              <h3 className="text-sm font-semibold text-[#17263C]">
                {topProductMode === "profit" ? "Most Profitable Items" : "Best-Selling Products"}
              </h3>
            </div>
            <div className="inline-flex items-center p-0.5 bg-[#F7F8F6] border border-[#E6EAE9] rounded-md text-[11px]">
              <button
                type="button"
                onClick={() => setTopProductMode("revenue")}
                className={`px-2 py-1 rounded font-medium cursor-pointer ${
                  topProductMode === "revenue" ? "bg-white text-[#17263C] shadow-xs" : "text-[#758195]"
                }`}
              >
                By Sales
              </button>
              <button
                type="button"
                onClick={() => setTopProductMode("profit")}
                className={`px-2 py-1 rounded font-medium cursor-pointer ${
                  topProductMode === "profit" ? "bg-white text-[#147D75] shadow-xs" : "text-[#758195]"
                }`}
              >
                By Profit
              </button>
            </div>
          </div>
          {topProductsDisplayed.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#758195]">No product sales in selected range.</p>
          ) : (
            <div className="divide-y divide-[#E6EAE9] mt-1">
              {topProductsDisplayed.map((p) => {
                const marginPct = p.netRevenue > 0 ? Math.round((p.grossProfit / p.netRevenue) * 100) : 0;
                return (
                  <div key={p.productId} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#17263C] truncate">{p.productName}</p>
                      <p className="text-[11px] text-[#758195] font-mono-num">
                        {p.quantitySold} {p.unit} sold · {marginPct}% margin
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={`text-xs font-mono-num font-semibold ${
                          topProductMode === "profit" ? "text-[#147D75]" : "text-[#17263C]"
                        }`}
                      >
                        {topProductMode === "profit"
                          ? `+${formatCurrency(p.grossProfit, currency)}`
                          : formatCurrency(p.netRevenue, currency)}
                      </p>
                      <p className="text-[11px] text-[#758195] font-mono-num">
                        {topProductMode === "profit"
                          ? `Sales ${formatCurrency(p.netRevenue, currency)}`
                          : `Profit +${formatCurrency(p.grossProfit, currency)}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="bg-white border border-[#E6EAE9] rounded-xl p-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#E6EAE9]">
            <h3 className="text-sm font-semibold text-[#17263C]">Recent Sales</h3>
            <button
              type="button"
              onClick={() => setActiveTab("sales")}
              className="text-xs font-medium text-[#147D75] hover:underline cursor-pointer"
            >
              View All
            </button>
          </div>
          {recentSales.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#758195]">No sales recorded yet.</p>
          ) : (
            <div className="divide-y divide-[#E6EAE9] mt-1">
              {recentSales.map((s) => (
                <div key={s.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium font-mono-num text-[#17263C]">{s.receiptNumber}</p>
                    <p className="text-[11px] text-[#758195] truncate">
                      {formatDateDisplay(s.transactionDate, activeBusiness?.dateFormat)} ·{" "}
                      {s.paymentMethod.replace("_", " ")}
                      {s.customerName ? ` · ${s.customerName}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-mono-num font-semibold text-[#17263C]">
                      {formatCurrency(s.totalAmount, currency)}
                    </p>
                    <p
                      className={`text-[10px] font-medium ${
                        s.status === "CANCELLED"
                          ? "text-[#C84C4C]"
                          : s.status === "COMPLETED"
                          ? "text-[#21865B]"
                          : "text-[#D99A31]"
                      }`}
                    >
                      {s.status.replace("_", " ")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Business Activity Feed */}
        <div className="bg-white border border-[#E6EAE9] rounded-xl p-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#E6EAE9]">
            <h3 className="text-sm font-semibold text-[#17263C]">Recent Activity</h3>
            <span className="text-[11px] text-[#758195]">Audit Log</span>
          </div>
          {auditLogs.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#758195]">
              Stock adjustments, sales, and purchases will appear here automatically.
            </p>
          ) : (
            <div className="divide-y divide-[#E6EAE9] mt-1">
              {auditLogs.slice(0, 6).map((log) => (
                <div key={log.id} className="py-2.5">
                  <p className="text-xs text-[#17263C] leading-snug">{log.summary}</p>
                  <p className="text-[11px] text-[#758195] mt-0.5">
                    {log.action.replace(/_/g, " ")} · {log.actorName}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
