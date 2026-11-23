import React, { useMemo, useState } from "react";
import { AlertCircle, Bot, Send, Sparkles } from "lucide-react";
import { useStore } from "../context/StoreContext";
import { calculateFinancialSummary, resolveDateRange } from "../lib/finance";
import { Button } from "../components/ui/Primitives";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_QUESTIONS = [
  "How much did I sell today?",
  "What was my estimated gross profit this week?",
  "Which products sold the most this month?",
  "What items need restocking?",
  "What were my biggest expenses?",
  "Suggest improvements based on my sales data",
];

export function AiAssistantPage() {
  const {
    user,
    activeBusiness,
    isSampleMode,
    products,
    variants,
    sales,
    saleItems,
    purchases,
    expenses,
    customers,
    suppliers,
    payments,
  } = useStore();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Deterministic backend-safe context calculated strictly for the active business
  const businessContext = useMemo(() => {
    if (!activeBusiness) return {};
    const todayRange = resolveDateRange("today");
    const weekRange = resolveDateRange("last7");
    const monthRange = resolveDateRange("thisMonth");

    const todaySummary = calculateFinancialSummary({
      sales,
      saleItems,
      purchases,
      expenses,
      products,
      variants,
      payments,
      startDate: todayRange.startDate,
      endDate: todayRange.endDate,
    });

    const weekSummary = calculateFinancialSummary({
      sales,
      saleItems,
      purchases,
      expenses,
      products,
      variants,
      payments,
      startDate: weekRange.startDate,
      endDate: weekRange.endDate,
    });

    const monthSummary = calculateFinancialSummary({
      sales,
      saleItems,
      purchases,
      expenses,
      products,
      variants,
      payments,
      startDate: monthRange.startDate,
      endDate: monthRange.endDate,
    });

    return {
      businessProfile: {
        name: activeBusiness.name,
        category: activeBusiness.category,
        currency: activeBusiness.currency,
        country: activeBusiness.country,
        taxEnabled: Boolean(activeBusiness.taxEnabled),
      },
      dataQuality: {
        activeProductCount: monthSummary.activeProductCount,
        totalSalesRecordedAllTime: sales.filter((s) => s.status !== "CANCELLED").length,
        hasIncompleteProductCostData: monthSummary.hasIncompleteCostData,
      },
      today: {
        date: todayRange.startDate,
        netSalesRevenue: todaySummary.netSalesRevenue,
        taxCollected: todaySummary.taxCollected,
        cogs: todaySummary.cogs,
        estimatedGrossProfit: todaySummary.grossProfit,
        operatingExpenses: todaySummary.operatingExpenses,
        estimatedOperatingProfit: todaySummary.estimatedOperatingProfit,
        transactionCount: todaySummary.transactionCount,
        paymentCollections: {
          cash: todaySummary.cashCollected,
          upi: todaySummary.upiCollected,
          card: todaySummary.cardCollected,
          bankTransfer: todaySummary.bankCollected,
          creditSales: todaySummary.creditSales,
        },
      },
      last7Days: {
        period: `${weekRange.startDate} to ${weekRange.endDate}`,
        netSalesRevenue: weekSummary.netSalesRevenue,
        cogs: weekSummary.cogs,
        estimatedGrossProfit: weekSummary.grossProfit,
        grossMarginPct: weekSummary.grossMarginPct,
        operatingExpenses: weekSummary.operatingExpenses,
        estimatedOperatingProfit: weekSummary.estimatedOperatingProfit,
        transactionCount: weekSummary.transactionCount,
      },
      thisMonth: {
        period: `${monthRange.startDate} to ${monthRange.endDate}`,
        netSalesRevenue: monthSummary.netSalesRevenue,
        taxCollected: monthSummary.taxCollected,
        discountsGiven: monthSummary.discountsGiven,
        refundsTotal: monthSummary.refundsTotal,
        cogs: monthSummary.cogs,
        estimatedGrossProfit: monthSummary.grossProfit,
        grossMarginPct: monthSummary.grossMarginPct,
        operatingExpenses: monthSummary.operatingExpenses,
        estimatedOperatingProfit: monthSummary.estimatedOperatingProfit,
        purchasesTotal: monthSummary.purchaseValueTotal,
        topExpenseCategories: monthSummary.expenseByCategory.slice(0, 6),
        bestSellingProducts: monthSummary.bestSellingProducts.slice(0, 8),
        slowMovingProducts: monthSummary.slowMovingProducts.slice(0, 6),
      },
      inventoryStatusNow: {
        inventoryValuationAtCost: monthSummary.inventoryValuation,
        totalStockUnits: monthSummary.totalStockUnits,
        outOfStockCount: monthSummary.outOfStockCount,
        lowOrOutOfStockItems: monthSummary.lowStockProducts.slice(0, 15).map((item) => ({
          name: item.name,
          currentStock: item.currentStock,
          minStockLevel: item.minStockLevel,
          unit: item.unit,
          status: item.status,
          suggestedReorderQty: item.suggestedReorderQty,
        })),
        expiringWithin30Days: monthSummary.expiringSoonProducts.slice(0, 10),
      },
      outstandingBalancesNow: {
        pendingCustomerReceivables: monthSummary.pendingCustomerReceivables,
        customersWithCreditCount: customers.filter((c) => c.outstandingCredit > 0).length,
        pendingSupplierPayables: monthSummary.pendingSupplierPayables,
        suppliersWithPayablesCount: suppliers.filter((s) => s.outstandingPayable > 0).length,
      },
    };
  }, [activeBusiness, products, variants, sales, saleItems, purchases, expenses, customers, suppliers, payments]);

  const askQuestion = async (rawQuestion: string) => {
    const q = rawQuestion.trim();
    if (!q || loading) return;

    setError("");
    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      content: q,
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput("");
    setLoading(true);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (!isSampleMode) {
        if (!user) {
          throw new Error("Please sign in to query your live business data.");
        }
        const token = await user.getIdToken();
        headers.Authorization = `Bearer ${token}`;
      }

      const resp = await fetch("/api/ai/assistant", {
        method: "POST",
        headers,
        body: JSON.stringify({
          question: q,
          language: activeBusiness?.language || "en",
          isSampleMode,
          businessContext,
          history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = (await resp.json()) as { answer?: string; error?: string };
      if (!resp.ok || !data.answer) {
        throw new Error(data.error || "Unable to get a response from the assistant.");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: "assistant",
          content: data.answer!,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assistant request failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="bg-white border border-[#E6EAE9] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#17263C] text-white flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#17263C]">AI Business Assistant</h2>
            <p className="text-xs text-[#758195] mt-0.5 leading-relaxed">
              Ask questions about {activeBusiness?.name} in plain language. Answers use only your verified{" "}
              {isSampleMode ? "sample store" : "live store"} figures and never alter your inventory or bills.
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="secondary" size="sm" onClick={() => setMessages([])}>
            Clear Chat
          </Button>
        )}
      </div>

      {/* Suggested Prompts */}
      <div className="bg-white border border-[#E6EAE9] rounded-xl p-4">
        <p className="text-xs font-medium text-[#758195] mb-2.5 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#147D75]" />
          Suggested questions for {activeBusiness?.name}
        </p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              disabled={loading}
              onClick={() => askQuestion(q)}
              className="px-3 py-2 rounded-lg border border-[#E6EAE9] bg-[#F7F8F6] hover:border-[#147D75] hover:bg-white text-xs font-medium text-[#17263C] transition-colors cursor-pointer text-left disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation Thread */}
      <div className="bg-white border border-[#E6EAE9] rounded-xl flex flex-col min-h-[340px]">
        <div className="flex-1 p-5 space-y-4 overflow-y-auto max-h-[520px]">
          {messages.length === 0 ? (
            <div className="py-12 text-center max-w-md mx-auto">
              <p className="text-sm font-semibold text-[#17263C]">Ask anything about your shop</p>
              <p className="text-xs text-[#758195] mt-1.5 leading-relaxed">
                Click a question above or type your own below. The assistant distinguishes actual recorded figures
                from estimates and explains accounting terms simply.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-[#17263C] text-white"
                      : "bg-[#F7F8F6] border border-[#E6EAE9] text-[#17263C]"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-[#F7F8F6] border border-[#E6EAE9] rounded-xl px-4 py-3 text-xs text-[#758195]">
                Analysing your store figures...
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mx-5 mb-3 p-3 rounded-lg bg-[#C84C4C]/10 border border-[#C84C4C]/25 text-xs text-[#C84C4C] flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            askQuestion(input);
          }}
          className="p-3.5 border-t border-[#E6EAE9] flex items-center gap-2.5 bg-[#F7F8F6] rounded-b-xl"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask e.g. Which items need restocking urgently?"
            maxLength={1500}
            className="flex-1 min-h-[44px] px-3.5 py-2 bg-white border border-[#E6EAE9] rounded-lg text-sm text-[#17263C] placeholder:text-[#758195]/70 focus:outline-none focus:border-[#147D75]"
          />
          <Button type="submit" variant="accent" disabled={loading || !input.trim()}>
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Ask</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
