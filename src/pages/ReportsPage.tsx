import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Download,
  Printer,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
  resolveDateRange,
  toLocalDateKey,
  type DatePreset,
} from "../lib/finance";
import { Button, InfoTip, TextInput } from "../components/ui/Primitives";

type ReportTab = "daily" | "weekly" | "monthly" | "custom";

export function ReportsPage() {
  const {
    activeBusiness,
    products,
    variants,
    sales,
    saleItems,
    purchases,
    expenses,
    payments,
    showToast,
  } = useStore();

  const [reportTab, setReportTab] = useState<ReportTab>("monthly");
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 13);
    return toLocalDateKey(d);
  });
  const [customEnd, setCustomEnd] = useState(toLocalDateKey());

  const currency = activeBusiness?.currency || "INR";
  const dateFmt = activeBusiness?.dateFormat || "DD/MM/YYYY";

  const presetMap: Record<ReportTab, DatePreset> = {
    daily: "today",
    weekly: "last7",
    monthly: "thisMonth",
    custom: "custom",
  };

  const { startDate, endDate } = useMemo(
    () => resolveDateRange(presetMap[reportTab], customStart, customEnd),
    [reportTab, customStart, customEnd]
  );

  const summary = useMemo(
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

  const handleExportCsv = () => {
    const rows: Array<Array<string | number>> = [
      ["RetailMate Financial & Store Report"],
      ["Business", activeBusiness?.name || "Retail Store"],
      ["Period", `${formatDateDisplay(startDate, dateFmt)} to ${formatDateDisplay(endDate, dateFmt)}`],
      ["Currency", currency],
      [],
      ["Metric", "Value", "Notes"],
      ["Net Sales Revenue (Excl. Tax)", summary.netSalesRevenue, "Sales after discounts and returns, excluding tax"],
      ["Tax Collected", summary.taxCollected, "Tax charged on completed/partial bills"],
      ["Discounts Given", summary.discountsGiven, "Total bill discounts applied"],
      ["Refunds Issued", summary.refundsTotal, "Returned items value"],
      ["Cost of Goods Sold (COGS)", summary.cogs, "Cost of items actually sold"],
      ["Estimated Gross Profit", summary.grossProfit, `Margin ${summary.grossMarginPct}%`],
      ["Operating Expenses", summary.operatingExpenses, "Rent, wages, utilities, etc. (excludes stock purchases)"],
      ["Estimated Operating Profit", summary.estimatedOperatingProfit, "Gross Profit minus Operating Expenses"],
      ["Inventory Purchases Recorded", summary.purchaseValueTotal, "Stock bills in selected period"],
      ["Current Inventory Valuation (At Cost)", summary.inventoryValuation, `${summary.totalStockUnits} total units`],
      ["Cash Collected", summary.cashCollected, ""],
      ["UPI Collected", summary.upiCollected, ""],
      ["Card Collected", summary.cardCollected, ""],
      ["Bank Transfer Collected", summary.bankCollected, ""],
      ["Credit Sales Pending", summary.creditSales, ""],
      [],
      ["Best-Selling Products", "Qty Sold", "Unit", "Net Revenue", "COGS", "Gross Profit", "Stock Left"],
      ...summary.bestSellingProducts.map((p) => [
        p.productName,
        p.quantitySold,
        p.unit,
        p.netRevenue,
        p.cogs,
        p.grossProfit,
        p.currentStock,
      ]),
      [],
      ["Expense Category Breakdown", "Amount"],
      ...summary.expenseByCategory.map((e) => [e.category, e.amount]),
      [],
      ["Low / Out of Stock Items", "Current Stock", "Min Level", "Status"],
      ...summary.lowStockProducts.map((l) => [l.name, l.currentStock, l.minStockLevel, l.status]),
    ];

    const csv = rows
      .map((line) => line.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `retailmate-report-${startDate}-to-${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Report exported as CSV.", "success");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-5 print-area">
      {/* Header & Period Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#17263C]">Reports & Analytics</h2>
          <p className="text-xs text-[#758195] mt-0.5">
            {activeBusiness?.name} · {formatDateDisplay(startDate, dateFmt)} to{" "}
            {formatDateDisplay(endDate, dateFmt)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          <Button variant="secondary" size="sm" onClick={handleExportCsv}>
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          <Button variant="primary" size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4" />
            Print / Save PDF
          </Button>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="bg-white border border-[#E6EAE9] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "daily", label: "Daily Report (Today)" },
            { id: "weekly", label: "Weekly Report (7 Days)" },
            { id: "monthly", label: "Monthly Report (This Month)" },
            { id: "custom", label: "Custom Date Range" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setReportTab(tab.id as ReportTab)}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer min-h-[38px] ${
                reportTab === tab.id
                  ? "bg-[#17263C] text-white"
                  : "bg-[#F7F8F6] text-[#758195] hover:text-[#17263C]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {reportTab === "custom" && (
          <div className="flex flex-wrap items-center gap-2">
            <TextInput
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="w-auto min-h-[38px] py-1 text-xs"
            />
            <span className="text-xs text-[#758195]">to</span>
            <TextInput
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="w-auto min-h-[38px] py-1 text-xs"
            />
          </div>
        )}
      </div>

      {summary.hasIncompleteCostData && (
        <div className="bg-[#D99A31]/10 border border-[#D99A31]/30 rounded-xl px-4 py-3 flex items-start gap-2.5 text-xs text-[#17263C]">
          <AlertTriangle className="w-4 h-4 text-[#D99A31] shrink-0 mt-0.5" />
          <span>
            Some active products have a purchase cost of 0. Gross profit and stock valuation are{" "}
            <strong>estimates</strong> until purchase costs are updated in Products & Inventory.
          </span>
        </div>
      )}

      {/* Core Financial Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E6EAE9] rounded-xl p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#758195]">Net Sales Revenue</span>
            <InfoTip text="Money earned from sales after discounts and customer returns, excluding tax." />
          </div>
          <p className="text-xl font-bold font-mono-num text-[#17263C] mt-1.5">
            {formatCurrency(summary.netSalesRevenue, currency)}
          </p>
          <p className="text-xs text-[#758195] mt-1 font-mono-num">
            {summary.transactionCount} bill(s) · Tax: {formatCurrency(summary.taxCollected, currency)}
          </p>
        </div>

        <div className="bg-white border border-[#E6EAE9] rounded-xl p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#758195]">Estimated Gross Profit</span>
            <InfoTip text="Net Sales Revenue minus Cost of Goods Sold (what the sold items cost you to buy)." />
          </div>
          <p
            className={`text-xl font-bold font-mono-num mt-1.5 ${
              summary.grossProfit >= 0 ? "text-[#21865B]" : "text-[#C84C4C]"
            }`}
          >
            {formatCurrency(summary.grossProfit, currency)}
          </p>
          <p className="text-xs text-[#758195] mt-1 font-mono-num">
            Margin: {summary.grossMarginPct}% · COGS: {formatCurrency(summary.cogs, currency)}
          </p>
        </div>

        <div className="bg-white border border-[#E6EAE9] rounded-xl p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#758195]">Operating Expenses</span>
            <InfoTip text="Shop running costs like rent, electricity, wages, and packaging. Does not include inventory stock purchases." />
          </div>
          <p className="text-xl font-bold font-mono-num text-[#17263C] mt-1.5">
            {formatCurrency(summary.operatingExpenses, currency)}
          </p>
          <p className="text-xs text-[#758195] mt-1 font-mono-num">
            Stock bought in period: {formatCurrency(summary.purchaseValueTotal, currency)}
          </p>
        </div>

        <div className="bg-white border border-[#E6EAE9] rounded-xl p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#758195]">Estimated Operating Profit</span>
            <InfoTip text="Estimated Gross Profit minus Operating Expenses. Shows how much the shop kept after running costs." />
          </div>
          <p
            className={`text-xl font-bold font-mono-num mt-1.5 ${
              summary.estimatedOperatingProfit >= 0 ? "text-[#147D75]" : "text-[#C84C4C]"
            }`}
          >
            {formatCurrency(summary.estimatedOperatingProfit, currency)}
          </p>
          <p className="text-xs text-[#758195] mt-1 font-mono-num">
            Stock value now: {formatCurrency(summary.inventoryValuation, currency)}
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily Revenue vs Gross Profit Trend */}
        <div className="bg-white border border-[#E6EAE9] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[#17263C]">Sales, COGS & Gross Profit Trend</h3>
              <p className="text-xs text-[#758195]">Day-by-day revenue versus item cost and profit</p>
            </div>
            <BarChart3 className="w-4 h-4 text-[#147D75]" />
          </div>
          {summary.salesTrendDaily.length === 0 ? (
            <p className="text-xs text-[#758195] py-12 text-center">No daily data in this range.</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={summary.salesTrendDaily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6EAE9" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => String(v).slice(5)}
                    tick={{ fontSize: 11, fill: "#758195" }}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "#758195" }} width={62} />
                  <Tooltip
                    formatter={(value: unknown) => formatCurrency(Number(value || 0), currency)}
                    labelFormatter={(lbl) => formatDateDisplay(String(lbl), dateFmt)}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="netRevenue" name="Net Sales" stroke="#17263C" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="cogs" name="Item Cost (COGS)" stroke="#D99A31" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="grossProfit" name="Gross Profit" stroke="#147D75" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Payment Method & Expense Breakdown */}
        <div className="bg-white border border-[#E6EAE9] rounded-xl p-5 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-[#17263C]">Payment Collections & Credit</h3>
            <p className="text-xs text-[#758195] mb-3">
              Actual money collected by method vs unpaid customer credit
            </p>
            {summary.paymentMethodBreakdown.length === 0 ? (
              <p className="text-xs text-[#758195] py-6 text-center bg-[#F7F8F6] rounded-lg">
                No sales recorded during this period.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {summary.paymentMethodBreakdown.map((pm) => (
                  <div key={pm.method} className="p-3 rounded-lg bg-[#F7F8F6] border border-[#E6EAE9]">
                    <p className="text-[11px] text-[#758195]">{pm.method}</p>
                    <p className="text-sm font-bold font-mono-num text-[#17263C] mt-0.5">
                      {formatCurrency(pm.amount, currency)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-[#E6EAE9]">
            <h4 className="text-xs font-semibold text-[#17263C] mb-2">Expenses by Category</h4>
            {summary.expenseByCategory.length === 0 ? (
              <p className="text-xs text-[#758195] py-4 text-center bg-[#F7F8F6] rounded-lg">
                No operating expenses recorded in this period.
              </p>
            ) : (
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.expenseByCategory} layout="vertical" margin={{ left: 10, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E6EAE9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#758195" }} />
                    <YAxis type="category" dataKey="category" width={120} tick={{ fontSize: 11, fill: "#17263C" }} />
                    <Tooltip formatter={(value: unknown) => formatCurrency(Number(value || 0), currency)} />
                    <Bar dataKey="amount" name="Expense" fill="#17263C" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Product Performance Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Best-Selling Products */}
        <div className="bg-white border border-[#E6EAE9] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E6EAE9] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#21865B]" />
              <h3 className="text-sm font-semibold text-[#17263C]">Best-Selling Products</h3>
            </div>
            <span className="text-xs text-[#758195]">Top 10 by revenue</span>
          </div>
          {summary.bestSellingProducts.length === 0 ? (
            <p className="p-6 text-xs text-[#758195] text-center">No sales recorded in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F7F8F6] border-b border-[#E6EAE9] text-[#758195]">
                    <th className="py-2.5 px-4 font-medium">Product</th>
                    <th className="py-2.5 px-3 font-medium text-right">Qty</th>
                    <th className="py-2.5 px-3 font-medium text-right">Revenue</th>
                    <th className="py-2.5 px-4 font-medium text-right">Est. Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6EAE9]">
                  {summary.bestSellingProducts.map((item) => (
                    <tr key={item.productId}>
                      <td className="py-2.5 px-4 font-medium text-[#17263C]">{item.productName}</td>
                      <td className="py-2.5 px-3 text-right font-mono-num">
                        {item.quantitySold} {item.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num">
                        {formatCurrency(item.netRevenue, currency)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono-num text-[#21865B] font-medium">
                        {formatCurrency(item.grossProfit, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Slow-Moving Stock */}
        <div className="bg-white border border-[#E6EAE9] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E6EAE9] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-[#D99A31]" />
              <h3 className="text-sm font-semibold text-[#17263C]">Slow-Moving Stock</h3>
            </div>
            <span className="text-xs text-[#758195]">Items in stock with lowest sales</span>
          </div>
          {summary.slowMovingProducts.length === 0 ? (
            <p className="p-6 text-xs text-[#758195] text-center">No slow-moving stock detected.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F7F8F6] border-b border-[#E6EAE9] text-[#758195]">
                    <th className="py-2.5 px-4 font-medium">Product</th>
                    <th className="py-2.5 px-3 font-medium text-right">Sold</th>
                    <th className="py-2.5 px-4 font-medium text-right">Stock Sitting</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6EAE9]">
                  {summary.slowMovingProducts.map((item) => (
                    <tr key={item.productId}>
                      <td className="py-2.5 px-4 font-medium text-[#17263C]">{item.productName}</td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-[#758195]">
                        {item.quantitySold} {item.unit}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono-num text-[#17263C]">
                        {item.currentStock} {item.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Credit & Receivables / Payables Summary */}
      <div className="bg-white border border-[#E6EAE9] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[#17263C] mb-3">Cash Flow & Pending Balances</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-lg bg-[#F7F8F6] border border-[#E6EAE9]">
            <p className="text-[#758195]">Customer Credit Collected (Period)</p>
            <p className="text-base font-bold font-mono-num text-[#21865B] mt-1">
              {formatCurrency(summary.customerCreditRepayments, currency)}
            </p>
          </div>
          <div className="p-3.5 rounded-lg bg-[#F7F8F6] border border-[#E6EAE9]">
            <p className="text-[#758195]">Supplier Payments Made (Period)</p>
            <p className="text-base font-bold font-mono-num text-[#17263C] mt-1">
              {formatCurrency(summary.supplierPaymentsMade, currency)}
            </p>
          </div>
          <div className="p-3.5 rounded-lg bg-[#F7F8F6] border border-[#E6EAE9]">
            <p className="text-[#758195]">Total Customer Credit Due (Now)</p>
            <p className="text-base font-bold font-mono-num text-[#147D75] mt-1">
              {formatCurrency(summary.pendingCustomerReceivables, currency)}
            </p>
          </div>
          <div className="p-3.5 rounded-lg bg-[#F7F8F6] border border-[#E6EAE9]">
            <p className="text-[#758195]">Total Supplier Payables Due (Now)</p>
            <p className="text-base font-bold font-mono-num text-[#D99A31] mt-1">
              {formatCurrency(summary.pendingSupplierPayables, currency)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
