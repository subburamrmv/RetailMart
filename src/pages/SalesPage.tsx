import React, { useMemo, useState } from "react";
import {
  CheckCircle2,
  CloudOff,
  Minus,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShoppingBag,
  Trash2,
  XCircle,
} from "lucide-react";
import { useStore } from "../context/StoreContext";
import {
  formatCurrency,
  formatDateDisplay,
  parsePositiveQty,
  roundMoney,
  roundQty,
  sanitizeDecimalInput,
  toLocalDateKey,
} from "../lib/finance";
import { enqueueOfflineSale } from "../lib/offlineQueue";
import { cancelSale, completeSale, makeId, returnSaleItems } from "../lib/storeService";
import type {
  CartLineItem,
  PaymentBreakdown,
  PaymentMethod,
  Product,
  ProductVariant,
  Sale,
} from "../types/retail";
import { ReceiptModal } from "../components/ReceiptModal";
import {
  Button,
  EmptyState,
  FieldLabel,
  Modal,
  SelectInput,
  TextInput,
} from "../components/ui/Primitives";

export function SalesPage() {
  const {
    user,
    userProfile,
    activeBusiness,
    userRole,
    isSampleMode,
    isOnline,
    products,
    variants,
    sales,
    saleItems,
    customers,
    pendingOfflineSales,
    refreshOfflineQueue,
    syncOfflineSales,
    showToast,
    sampleCompleteSale,
    updateSampleBundle,
  } = useStore();

  interface PosCartRow extends CartLineItem {
    key: string;
    quantityInput: string;
  }

  const [tab, setTab] = useState<"pos" | "history">("pos");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<PosCartRow[]>([]);
  const [cartValidationError, setCartValidationError] = useState("");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [splitCash, setSplitCash] = useState("0");
  const [splitUpi, setSplitUpi] = useState("0");
  const [splitCard, setSplitCard] = useState("0");
  const [splitCredit, setSplitCredit] = useState("0");
  const [customerId, setCustomerId] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Receipt, Return & Cancel modals
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null);
  const [returnSale, setReturnSale] = useState<Sale | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Sale | null>(null);
  const [variantPickerProduct, setVariantPickerProduct] = useState<Product | null>(null);

  // History filters
  const [historySearch, setHistorySearch] = useState("");
  const [historyMethod, setHistoryMethod] = useState("ALL");
  const [historyDate, setHistoryDate] = useState("");

  const currency = activeBusiness?.currency || "INR";

  const activeProducts = useMemo(() => products.filter((p) => p.isActive), [products]);

  const variantsByProduct = useMemo(() => {
    const map = new Map<string, ProductVariant[]>();
    for (const v of variants) {
      if (!v.isActive) continue;
      const list = map.get(v.productId) || [];
      list.push(v);
      map.set(v.productId, list);
    }
    return map;
  }, [variants]);

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeProducts.slice(0, 24);
    return activeProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode || "").toLowerCase().includes(q)
    );
  }, [activeProducts, search]);

  const addToCart = (product: Product, variant?: ProductVariant) => {
    const pVars = variantsByProduct.get(product.id) || [];
    if (product.hasVariants && pVars.length > 0 && !variant) {
      setVariantPickerProduct(product);
      return;
    }

    const available = variant ? variant.currentStock : product.currentStock;
    if (available <= 0) {
      showToast(`${product.name}${variant ? ` (${variant.variantName})` : ""} is out of stock.`, "warning");
      return;
    }

    const label = variant ? `${product.name} (${variant.variantName})` : product.name;
    const price = variant ? variant.sellingPrice : product.sellingPrice;
    const cost = variant ? variant.purchaseCost : product.purchaseCost;
    const key = `${product.id}::${variant?.id || "base"}`;

    setCartValidationError("");
    setCart((prev) => {
      const existing = prev.find((c) => c.key === key);
      if (existing) {
        const nextQty = roundQty((existing.quantity || 0) + 1);
        if (nextQty > available) {
          showToast(`Only ${available} ${product.unit} available in stock.`, "warning");
          return prev;
        }
        return prev.map((c) =>
          c.key === key ? { ...c, quantity: nextQty, quantityInput: String(nextQty) } : c
        );
      }
      const initialQty = available >= 1 ? 1 : available;
      return [
        ...prev,
        {
          key,
          productId: product.id,
          variantId: variant?.id,
          productName: label,
          unit: product.unit,
          quantity: initialQty,
          quantityInput: String(initialQty),
          unitPrice: price,
          unitCostSnapshot: cost,
          taxRate: product.taxRate || 0,
          maxAvailableStock: available,
        },
      ];
    });
  };

  const handleCartQtyInputChange = (rowKey: string, rawValue: string) => {
    const sanitized = sanitizeDecimalInput(rawValue, 3);
    if (sanitized === null) return;

    setCartValidationError("");
    setCart((prev) =>
      prev.map((item) => {
        if (item.key !== rowKey) return item;
        if (sanitized === "") {
          return { ...item, quantityInput: "", quantity: 0 };
        }
        if (sanitized === ".") {
          return { ...item, quantityInput: ".", quantity: 0 };
        }
        const parsed = Number(sanitized);
        if (!Number.isFinite(parsed)) return item;
        if (parsed > item.maxAvailableStock) {
          showToast(
            `Max available for ${item.productName} is ${item.maxAvailableStock} ${item.unit}.`,
            "warning"
          );
          const capped = roundQty(item.maxAvailableStock);
          return { ...item, quantityInput: String(capped), quantity: capped };
        }
        return {
          ...item,
          quantityInput: sanitized,
          quantity: roundQty(parsed),
        };
      })
    );
  };

  const handleCartQtyBlur = (rowKey: string) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.key !== rowKey) return item;
        if (item.quantityInput.endsWith(".")) {
          const clean = item.quantityInput.slice(0, -1);
          return {
            ...item,
            quantityInput: clean,
            quantity: clean ? roundQty(Number(clean)) : 0,
          };
        }
        return item;
      })
    );
  };

  const stepCartQty = (rowKey: string, delta: number) => {
    setCartValidationError("");
    setCart((prev) =>
      prev.map((item) => {
        if (item.key !== rowKey) return item;
        const current = item.quantity || 0;
        const minStep = item.maxAvailableStock < 1 ? item.maxAvailableStock : 1;
        const rawNext = roundQty(current + delta);
        if (delta < 0 && rawNext < minStep) {
          return { ...item, quantity: minStep, quantityInput: String(minStep) };
        }
        if (rawNext > item.maxAvailableStock) {
          showToast(
            `Max available for ${item.productName} is ${item.maxAvailableStock} ${item.unit}.`,
            "warning"
          );
          return item;
        }
        return { ...item, quantity: rawNext, quantityInput: String(rawNext) };
      })
    );
  };

  const removeCartItem = (rowKey: string) => {
    setCartValidationError("");
    setCart((prev) => prev.filter((item) => item.key !== rowKey));
  };

  const totals = useMemo(() => {
    let subtotal = 0;
    let taxAmount = 0;
    for (const item of cart) {
      const qty = Math.max(0, item.quantity);
      const gross = roundMoney(item.unitPrice * qty);
      const effTaxRate = activeBusiness?.taxEnabled ? item.taxRate : 0;
      const tax = roundMoney((gross * effTaxRate) / 100);
      subtotal = roundMoney(subtotal + gross);
      taxAmount = roundMoney(taxAmount + tax);
    }
    const discount = Math.min(subtotal, Math.max(0, roundMoney(Number(discountAmount) || 0)));
    const total = Math.max(0, roundMoney(subtotal - discount + taxAmount));
    return { subtotal, discount, taxAmount, total };
  }, [cart, discountAmount, activeBusiness?.taxEnabled]);

  const buildPaymentBreakdown = (): PaymentBreakdown => {
    const t = totals.total;
    if (paymentMethod === "CASH") return { cash: t, upi: 0, card: 0, bankTransfer: 0, credit: 0 };
    if (paymentMethod === "UPI") return { cash: 0, upi: t, card: 0, bankTransfer: 0, credit: 0 };
    if (paymentMethod === "CARD") return { cash: 0, upi: 0, card: t, bankTransfer: 0, credit: 0 };
    if (paymentMethod === "BANK_TRANSFER") return { cash: 0, upi: 0, card: 0, bankTransfer: t, credit: 0 };
    if (paymentMethod === "CREDIT") return { cash: 0, upi: 0, card: 0, bankTransfer: 0, credit: t };
    return {
      cash: Math.max(0, roundMoney(Number(splitCash) || 0)),
      upi: Math.max(0, roundMoney(Number(splitUpi) || 0)),
      card: Math.max(0, roundMoney(Number(splitCard) || 0)),
      bankTransfer: 0,
      credit: Math.max(0, roundMoney(Number(splitCredit) || 0)),
    };
  };

  const handleCheckout = async () => {
    if (!activeBusiness || cart.length === 0 || submitting) return;

    // Validate every cart row has a valid positive quantity
    const invalidRow = cart.find((item) => {
      const valid = parsePositiveQty(item.quantityInput);
      return valid === null || valid > item.maxAvailableStock;
    });
    if (invalidRow) {
      const valid = parsePositiveQty(invalidRow.quantityInput);
      const msg =
        valid === null
          ? `Enter a valid quantity greater than 0 for "${invalidRow.productName}".`
          : `Requested quantity for "${invalidRow.productName}" exceeds available stock (${invalidRow.maxAvailableStock} ${invalidRow.unit}).`;
      setCartValidationError(msg);
      showToast(msg, "error");
      return;
    }

    const checkoutItems: CartLineItem[] = cart.map(({ key: _key, quantityInput, ...rest }) => ({
      ...rest,
      quantity: parsePositiveQty(quantityInput)!,
    }));

    const breakdown = buildPaymentBreakdown();
    const sumBreakdown = roundMoney(
      breakdown.cash + breakdown.upi + breakdown.card + breakdown.bankTransfer + breakdown.credit
    );
    if (paymentMethod === "SPLIT" && Math.abs(sumBreakdown - totals.total) > 0.05) {
      showToast(
        `Split amounts (${formatCurrency(sumBreakdown, currency)}) must equal total (${formatCurrency(totals.total, currency)}).`,
        "error"
      );
      return;
    }

    if (breakdown.credit > 0 && !customerId) {
      showToast("Please select a customer for credit / pay-later sales.", "warning");
      return;
    }

    const selectedCust = customers.find((c) => c.id === customerId);
    setSubmitting(true);
    setCartValidationError("");
    try {
      if (isSampleMode) {
        const completed = sampleCompleteSale({
          items: checkoutItems,
          discountAmount: totals.discount,
          paymentMethod,
          paymentBreakdown: breakdown,
          customerId: selectedCust?.id,
          customerName: selectedCust?.name,
          notes: notes.trim() || undefined,
        });
        setCart([]);
        setDiscountAmount("0");
        setNotes("");
        setCustomerId("");
        setReceiptSale(completed);
        showToast(`Sale ${completed.receiptNumber} recorded in sample store.`);
        return;
      }

      if (!isOnline) {
        const key = makeId("sal");
        enqueueOfflineSale(activeBusiness.id, {
          idempotencyKey: key,
          businessId: activeBusiness.id,
          createdAtIso: new Date().toISOString(),
          transactionDate: new Date().toISOString(),
          items: checkoutItems,
          discountAmount: totals.discount,
          paymentMethod,
          paymentBreakdown: breakdown,
          customerId: selectedCust?.id,
          customerName: selectedCust?.name,
          notes: notes.trim() || undefined,
          totalAmount: totals.total,
        });
        refreshOfflineQueue();
        setCart([]);
        setDiscountAmount("0");
        setNotes("");
        setCustomerId("");
        showToast("You are offline. Sale queued locally and will sync when internet returns.", "warning");
        return;
      }

      if (!user) return;
      const completed = await completeSale({
        business: activeBusiness,
        actorUid: user.uid,
        actorName: userProfile?.displayName || user.displayName || "Owner",
        items: checkoutItems,
        discountAmount: totals.discount,
        paymentMethod,
        paymentBreakdown: breakdown,
        customerId: selectedCust?.id,
        customerName: selectedCust?.name,
        notes: notes.trim() || undefined,
      });
      setCart([]);
      setDiscountAmount("0");
      setNotes("");
      setCustomerId("");
      setReceiptSale(completed);
      showToast(`Sale ${completed.receiptNumber} completed and stock updated!`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to complete sale.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSales = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return [...sales]
      .filter((s) => {
        if (historyMethod !== "ALL" && s.paymentMethod !== historyMethod) return false;
        if (historyDate && s.transactionDate.slice(0, 10) !== historyDate) return false;
        if (!q) return true;
        return (
          s.receiptNumber.toLowerCase().includes(q) ||
          (s.customerName || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  }, [sales, historySearch, historyMethod, historyDate]);

  return (
    <div className="space-y-5">
      {/* Top Mode Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-white border border-[#E6EAE9] rounded-lg">
          <button
            type="button"
            onClick={() => setTab("pos")}
            className={`px-3.5 py-2 text-xs font-medium rounded-md cursor-pointer ${
              tab === "pos" ? "bg-[#147D75] text-white" : "text-[#758195] hover:text-[#17263C]"
            }`}
          >
            New Sale (POS)
          </button>
          <button
            type="button"
            onClick={() => setTab("history")}
            className={`px-3.5 py-2 text-xs font-medium rounded-md cursor-pointer ${
              tab === "history" ? "bg-[#17263C] text-white" : "text-[#758195] hover:text-[#17263C]"
            }`}
          >
            Sales History ({sales.length})
          </button>
        </div>

        {pendingOfflineSales.length > 0 && !isSampleMode && (
          <div className="flex items-center gap-2 text-xs text-[#D99A31]">
            <CloudOff className="w-4 h-4" />
            <span>{pendingOfflineSales.length} unsynchronised offline sale(s)</span>
            {isOnline && (
              <Button size="sm" variant="secondary" onClick={syncOfflineSales}>
                Sync
              </Button>
            )}
          </div>
        )}
      </div>

      {/* POS Screen */}
      {tab === "pos" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left: Product Picker */}
          <div className="lg:col-span-7 space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-[#758195] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <TextInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search product by name, SKU, or scan barcode..."
                className="pl-10"
              />
            </div>

            {activeProducts.length === 0 ? (
              <EmptyState
                icon={<ShoppingBag className="w-5 h-5" />}
                title="No products available to sell"
                description="Add products in Products & Inventory first, then return here to bill customers."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredCatalog.map((p) => {
                  const pVars = variantsByProduct.get(p.id) || [];
                  const totalVarStock =
                    p.hasVariants && pVars.length > 0
                      ? pVars.reduce((s, v) => s + v.currentStock, 0)
                      : p.currentStock;
                  const out = totalVarStock <= 0;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={out}
                      onClick={() => addToCart(p)}
                      className={`p-3.5 bg-white border border-[#E6EAE9] rounded-xl text-left transition-colors flex items-center justify-between gap-3 min-h-[68px] ${
                        out
                          ? "opacity-55 cursor-not-allowed"
                          : "hover:border-[#147D75] active:scale-[0.99] cursor-pointer"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#17263C] truncate">{p.name}</p>
                        <p className="text-xs text-[#758195] mt-0.5">
                          <span className="font-mono-num">{p.sku}</span> ·{" "}
                          <span className={out ? "text-[#C84C4C] font-medium" : "font-mono-num"}>
                            {out ? "Out of stock" : `${totalVarStock} ${p.unit} left`}
                          </span>
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-mono-num font-bold text-[#147D75]">
                          {formatCurrency(p.sellingPrice, currency)}
                        </p>
                        <p className="text-[11px] text-[#758195]">per {p.unit}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Active Bill / Cart */}
          <div className="lg:col-span-5 bg-white border border-[#E6EAE9] rounded-xl p-5 space-y-4 lg:sticky lg:top-20">
            <div className="flex items-center justify-between border-b border-[#E6EAE9] pb-3">
              <h3 className="text-sm font-semibold text-[#17263C]">Current Bill ({cart.length})</h3>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-xs text-[#C84C4C] hover:underline cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#758195]">
                Tap any product on the left to add it to this bill.
              </div>
            ) : (
              <div className="divide-y divide-[#E6EAE9] max-h-72 overflow-y-auto">
                {cart.map((item) => {
                  const isQtyMissingOrZero = parsePositiveQty(item.quantityInput) === null;
                  return (
                    <div key={item.key} className="py-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#17263C] truncate">{item.productName}</p>
                          <p className="text-[11px] text-[#758195] font-mono-num">
                            {formatCurrency(item.unitPrice, currency)} / {item.unit}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-mono-num font-semibold text-[#17263C]">
                            {formatCurrency(item.unitPrice * Math.max(0, item.quantity), currency)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeCartItem(item.key)}
                            aria-label={`Remove ${item.productName}`}
                            title="Remove product"
                            className="p-1.5 rounded text-[#758195] hover:text-[#C84C4C] hover:bg-[#F7F8F6] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => stepCartQty(item.key, -1)}
                          aria-label={`Decrease quantity of ${item.productName}`}
                          className="w-9 h-9 rounded-lg border border-[#E6EAE9] flex items-center justify-center hover:bg-[#F7F8F6] cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="text"
                          inputMode="decimal"
                          aria-label={`Quantity for ${item.productName}`}
                          value={item.quantityInput}
                          onChange={(e) => handleCartQtyInputChange(item.key, e.target.value)}
                          onBlur={() => handleCartQtyBlur(item.key)}
                          onKeyDown={(e) => {
                            if (e.key === "Backspace" || e.key === "Delete") {
                              e.stopPropagation();
                            }
                          }}
                          placeholder="0"
                          className={`w-20 h-9 text-center border rounded-lg text-xs font-mono-num focus:outline-none ${
                            isQtyMissingOrZero
                              ? "border-[#C84C4C] focus:border-[#C84C4C]"
                              : "border-[#E6EAE9] focus:border-[#147D75]"
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => stepCartQty(item.key, 1)}
                          aria-label={`Increase quantity of ${item.productName}`}
                          className="w-9 h-9 rounded-lg border border-[#E6EAE9] flex items-center justify-center hover:bg-[#F7F8F6] cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[11px] text-[#758195]">{item.unit}</span>
                      </div>
                      {isQtyMissingOrZero && (
                        <p className="text-[11px] text-[#C84C4C]">
                          Enter a quantity greater than 0 before checkout.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {cartValidationError && (
              <div className="p-2.5 rounded-lg bg-[#C84C4C]/10 border border-[#C84C4C]/25 text-xs text-[#C84C4C]">
                {cartValidationError}
              </div>
            )}

            {/* Totals & Payment Controls */}
            <div className="border-t border-[#E6EAE9] pt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel label={`Discount (${currency})`} />
                  <TextInput
                    type="text"
                    inputMode="decimal"
                    value={discountAmount}
                    onChange={(e) => {
                      const clean = sanitizeDecimalInput(e.target.value, 2);
                      if (clean !== null) setDiscountAmount(clean);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" || e.key === "Delete") e.stopPropagation();
                    }}
                    placeholder="0"
                    className="!min-h-[40px] text-xs font-mono-num"
                  />
                </div>
                <div>
                  <FieldLabel label="Customer (Optional)" />
                  <SelectInput
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="!min-h-[40px] text-xs"
                  >
                    <option value="">Walk-in Customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </SelectInput>
                </div>
              </div>

              <div>
                <FieldLabel label="Payment Method" />
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      ["CASH", "Cash"],
                      ["UPI", "UPI"],
                      ["CARD", "Card"],
                      ["BANK_TRANSFER", "Bank"],
                      ["CREDIT", "Credit"],
                      ["SPLIT", "Split"],
                    ] as Array<[PaymentMethod, string]>
                  ).map(([val, lbl]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setPaymentMethod(val)}
                      className={`py-2 px-2 text-xs font-medium rounded-lg border min-h-[40px] cursor-pointer ${
                        paymentMethod === val
                          ? "bg-[#17263C] text-white border-[#17263C]"
                          : "bg-white text-[#17263C] border-[#E6EAE9] hover:bg-[#F7F8F6]"
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethod === "SPLIT" && (
                <div className="grid grid-cols-2 gap-2 p-3 bg-[#F7F8F6] rounded-lg border border-[#E6EAE9]">
                  <div>
                    <FieldLabel label="Cash" />
                    <TextInput
                      type="text"
                      inputMode="decimal"
                      value={splitCash}
                      onChange={(e) => {
                        const clean = sanitizeDecimalInput(e.target.value, 2);
                        if (clean !== null) setSplitCash(clean);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace" || e.key === "Delete") e.stopPropagation();
                      }}
                      className="!min-h-[36px] text-xs font-mono-num"
                    />
                  </div>
                  <div>
                    <FieldLabel label="UPI" />
                    <TextInput
                      type="text"
                      inputMode="decimal"
                      value={splitUpi}
                      onChange={(e) => {
                        const clean = sanitizeDecimalInput(e.target.value, 2);
                        if (clean !== null) setSplitUpi(clean);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace" || e.key === "Delete") e.stopPropagation();
                      }}
                      className="!min-h-[36px] text-xs font-mono-num"
                    />
                  </div>
                  <div>
                    <FieldLabel label="Card" />
                    <TextInput
                      type="text"
                      inputMode="decimal"
                      value={splitCard}
                      onChange={(e) => {
                        const clean = sanitizeDecimalInput(e.target.value, 2);
                        if (clean !== null) setSplitCard(clean);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace" || e.key === "Delete") e.stopPropagation();
                      }}
                      className="!min-h-[36px] text-xs font-mono-num"
                    />
                  </div>
                  <div>
                    <FieldLabel label="Credit Due" />
                    <TextInput
                      type="text"
                      inputMode="decimal"
                      value={splitCredit}
                      onChange={(e) => {
                        const clean = sanitizeDecimalInput(e.target.value, 2);
                        if (clean !== null) setSplitCredit(clean);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace" || e.key === "Delete") e.stopPropagation();
                      }}
                      className="!min-h-[36px] text-xs font-mono-num"
                    />
                  </div>
                </div>
              )}

              <div>
                <FieldLabel label="Bill Note" hint="Optional" />
                <TextInput
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional delivery or reference note"
                  className="!min-h-[38px] text-xs"
                />
              </div>

              <div className="space-y-1 text-xs pt-2 border-t border-[#E6EAE9]">
                <div className="flex justify-between text-[#758195]">
                  <span>Subtotal</span>
                  <span className="font-mono-num">{formatCurrency(totals.subtotal, currency)}</span>
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between text-[#21865B]">
                    <span>Discount</span>
                    <span className="font-mono-num">-{formatCurrency(totals.discount, currency)}</span>
                  </div>
                )}
                {totals.taxAmount > 0 && (
                  <div className="flex justify-between text-[#758195]">
                    <span>Tax</span>
                    <span className="font-mono-num">{formatCurrency(totals.taxAmount, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-[#17263C] pt-1">
                  <span>Total Payable</span>
                  <span className="font-mono-num">{formatCurrency(totals.total, currency)}</span>
                </div>
              </div>

              <Button
                variant="accent"
                size="lg"
                className="w-full"
                disabled={cart.length === 0 || submitting}
                onClick={handleCheckout}
              >
                <CheckCircle2 className="w-4 h-4" />
                {submitting ? "Completing Sale..." : `Complete Sale · ${formatCurrency(totals.total, currency)}`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sales History Tab */}
      {tab === "history" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
              <Search className="w-4 h-4 text-[#758195] absolute left-3 top-1/2 -translate-y-1/2" />
              <TextInput
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Receipt # or customer..."
                className="pl-9 !min-h-[38px] text-xs"
              />
            </div>
            <SelectInput
              value={historyMethod}
              onChange={(e) => setHistoryMethod(e.target.value)}
              className="!w-auto !min-h-[38px] text-xs"
            >
              <option value="ALL">All Payment Methods</option>
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="CARD">Card</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CREDIT">Credit</option>
              <option value="SPLIT">Split</option>
            </SelectInput>
            <TextInput
              type="date"
              value={historyDate}
              onChange={(e) => setHistoryDate(e.target.value)}
              className="!w-auto !min-h-[38px] text-xs"
            />
            {historyDate && (
              <Button variant="ghost" size="sm" onClick={() => setHistoryDate("")}>
                Clear Date
              </Button>
            )}
          </div>

          {filteredSales.length === 0 ? (
            <EmptyState
              icon={<ShoppingBag className="w-5 h-5" />}
              title="No matching sales"
              description="Completed sales will appear here with receipt printing, returns, and cancellation audit logs."
            />
          ) : (
            <div className="bg-white border border-[#E6EAE9] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E6EAE9] bg-[#F7F8F6] text-[11px] font-semibold text-[#758195]">
                      <th className="py-3 px-4">Receipt</th>
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-3">Customer</th>
                      <th className="py-3 px-3">Method</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Total</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6EAE9] text-xs">
                    {filteredSales.map((s) => (
                      <tr key={s.id} className="hover:bg-[#F7F8F6]/60">
                        <td className="py-3 px-4 font-mono-num font-semibold text-[#17263C]">
                          {s.receiptNumber}
                        </td>
                        <td className="py-3 px-3 font-mono-num text-[#758195]">
                          {formatDateDisplay(s.transactionDate, activeBusiness?.dateFormat)}
                        </td>
                        <td className="py-3 px-3 text-[#17263C]">{s.customerName || "Walk-in"}</td>
                        <td className="py-3 px-3 text-[#758195]">{s.paymentMethod.replace("_", " ")}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`font-medium ${
                              s.status === "CANCELLED"
                                ? "text-[#C84C4C]"
                                : s.status === "COMPLETED"
                                ? "text-[#21865B]"
                                : "text-[#D99A31]"
                            }`}
                          >
                            {s.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono-num font-semibold text-[#17263C]">
                          {formatCurrency(s.totalAmount, currency)}
                          {s.refundedAmount > 0 && (
                            <span className="block text-[10px] text-[#C84C4C]">
                              Refunded {formatCurrency(s.refundedAmount, currency)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setReceiptSale(s)}
                              title="View / Print receipt"
                              className="p-2 rounded-lg text-[#758195] hover:bg-[#F7F8F6] hover:text-[#17263C] cursor-pointer"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            {s.status !== "CANCELLED" && s.status !== "RETURNED" && (
                              <button
                                type="button"
                                onClick={() => setReturnSale(s)}
                                title="Return / Refund items"
                                className="p-2 rounded-lg text-[#758195] hover:bg-[#F7F8F6] hover:text-[#D99A31] cursor-pointer"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                            {s.status !== "CANCELLED" && userRole !== "CASHIER" && (
                              <button
                                type="button"
                                onClick={() => setCancelTarget(s)}
                                title="Cancel & reverse sale"
                                className="p-2 rounded-lg text-[#758195] hover:bg-[#F7F8F6] hover:text-[#C84C4C] cursor-pointer"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Variant Picker Modal */}
      {variantPickerProduct && (
        <Modal
          open={true}
          onClose={() => setVariantPickerProduct(null)}
          title={`Select Variation — ${variantPickerProduct.name}`}
          subtitle="Choose size or color option to add to bill."
        >
          <div className="divide-y divide-[#E6EAE9] border border-[#E6EAE9] rounded-lg">
            {(variantsByProduct.get(variantPickerProduct.id) || []).map((v) => (
              <button
                key={v.id}
                type="button"
                disabled={v.currentStock <= 0}
                onClick={() => {
                  addToCart(variantPickerProduct, v);
                  setVariantPickerProduct(null);
                }}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[#F7F8F6] disabled:opacity-50 cursor-pointer"
              >
                <div>
                  <p className="text-sm font-medium text-[#17263C]">{v.variantName}</p>
                  <p className="text-xs text-[#758195] font-mono-num">
                    {v.currentStock} {variantPickerProduct.unit} available
                  </p>
                </div>
                <span className="text-sm font-mono-num font-semibold text-[#147D75]">
                  {formatCurrency(v.sellingPrice, currency)}
                </span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Receipt Modal */}
      {activeBusiness && (
        <ReceiptModal
          open={Boolean(receiptSale)}
          onClose={() => setReceiptSale(null)}
          business={activeBusiness}
          sale={receiptSale}
          items={saleItems}
        />
      )}

      {/* Return Items Modal */}
      {returnSale && activeBusiness && (
        <ReturnSaleModal
          sale={returnSale}
          items={saleItems.filter((si) => si.saleId === returnSale.id)}
          currency={currency}
          onClose={() => setReturnSale(null)}
          onSubmit={async (returns, restock, reason) => {
            if (isSampleMode) {
              updateSampleBundle((prev) => {
                let refundAdd = 0;
                const nextSaleItems = prev.saleItems.map((si) => {
                  const found = returns.find((r) => r.saleItemId === si.id);
                  if (!found || found.returnQty <= 0) return si;
                  const perUnit = si.quantity > 0 ? si.lineTotal / si.quantity : 0;
                  refundAdd = roundMoney(refundAdd + perUnit * found.returnQty);
                  return { ...si, returnedQuantity: roundQty((si.returnedQuantity || 0) + found.returnQty) };
                });
                const nextProducts = restock
                  ? prev.products.map((p) => {
                      const retForProd = returns
                        .map((r) => ({ r, item: prev.saleItems.find((si) => si.id === r.saleItemId) }))
                        .filter((x) => x.item && x.item.productId === p.id && !x.item.variantId)
                        .reduce((s, x) => s + x.r.returnQty, 0);
                      return retForProd > 0 ? { ...p, currentStock: roundQty(p.currentStock + retForProd) } : p;
                    })
                  : prev.products;
                const nextSales = prev.sales.map((s) =>
                  s.id === returnSale.id
                    ? {
                        ...s,
                        refundedAmount: roundMoney(s.refundedAmount + refundAdd),
                        status:
                          s.refundedAmount + refundAdd >= s.totalAmount - 0.01
                            ? ("RETURNED" as const)
                            : ("PARTIALLY_RETURNED" as const),
                      }
                    : s
                );
                return { ...prev, products: nextProducts, saleItems: nextSaleItems, sales: nextSales };
              });
              showToast("Customer return recorded.");
              setReturnSale(null);
              return;
            }
            if (!user) return;
            await returnSaleItems({
              business: activeBusiness,
              actorUid: user.uid,
              actorName: userProfile?.displayName || user.displayName || "Owner",
              saleId: returnSale.id,
              returns,
              restock,
              reason,
            });
            showToast("Return processed and stock updated.");
            setReturnSale(null);
          }}
        />
      )}

      {/* Cancel / Reverse Sale Modal */}
      {cancelTarget && activeBusiness && (
        <CancelSaleModal
          sale={cancelTarget}
          currency={currency}
          onClose={() => setCancelTarget(null)}
          onConfirm={async (reason) => {
            if (isSampleMode) {
              updateSampleBundle((prev) => {
                if (cancelTarget.status === "CANCELLED") return prev;
                const itemsForSale = prev.saleItems.filter((si) => si.saleId === cancelTarget.id);
                const nextProducts = prev.products.map((p) => {
                  const restoreQty = itemsForSale
                    .filter((si) => si.productId === p.id && !si.variantId)
                    .reduce((s, si) => s + Math.max(0, si.quantity - (si.returnedQuantity || 0)), 0);
                  return restoreQty > 0 ? { ...p, currentStock: roundQty(p.currentStock + restoreQty) } : p;
                });
                return {
                  ...prev,
                  products: nextProducts,
                  sales: prev.sales.map((s) =>
                    s.id === cancelTarget.id
                      ? { ...s, status: "CANCELLED", refundedAmount: s.totalAmount, creditAmount: 0 }
                      : s
                  ),
                };
              });
              showToast(`Sale ${cancelTarget.receiptNumber} reversed.`);
              setCancelTarget(null);
              return;
            }
            if (!user) return;
            await cancelSale({
              business: activeBusiness,
              actorUid: user.uid,
              actorName: userProfile?.displayName || user.displayName || "Owner",
              saleId: cancelTarget.id,
              saleItems,
              reason,
            });
            showToast(`Sale ${cancelTarget.receiptNumber} cancelled and stock restored.`);
            setCancelTarget(null);
          }}
        />
      )}
    </div>
  );
}

function ReturnSaleModal({
  sale,
  items,
  currency,
  onClose,
  onSubmit,
}: {
  sale: Sale;
  items: Array<{ id: string; productName: string; unit: string; quantity: number; returnedQuantity: number; lineTotal: number }>;
  currency: string;
  onClose: () => void;
  onSubmit: (returns: Array<{ saleItemId: string; returnQty: number }>, restock: boolean, reason: string) => Promise<void>;
}) {
  const [qtyMap, setQtyMap] = useState<Record<string, string>>({});
  const [restock, setRestock] = useState(true);
  const [reason, setReason] = useState("Customer returned item");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const list: Array<{ saleItemId: string; returnQty: number }> = [];
    for (const it of items) {
      const raw = qtyMap[it.id] || "";
      if (!raw.trim()) continue;
      const qty = parsePositiveQty(raw);
      if (qty === null) continue;
      const remaining = roundQty(it.quantity - (it.returnedQuantity || 0));
      if (qty > remaining) {
        setErr(`Return quantity for "${it.productName}" cannot exceed ${remaining} ${it.unit}.`);
        return;
      }
      list.push({ saleItemId: it.id, returnQty: qty });
    }
    if (list.length === 0) {
      setErr("Enter return quantity greater than 0 for at least one item.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await onSubmit(list, restock, reason.trim() || "Customer return");
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Failed to process return.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={`Return Items — ${sale.receiptNumber}`}
      subtitle={`Original total: ${formatCurrency(sale.totalAmount, currency)}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {err && <div className="p-3 rounded-lg bg-[#C84C4C]/10 text-xs text-[#C84C4C]">{err}</div>}
        <div className="divide-y divide-[#E6EAE9] border border-[#E6EAE9] rounded-lg">
          {items.map((it) => {
            const remaining = roundQty(it.quantity - (it.returnedQuantity || 0));
            return (
              <div key={it.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-medium text-[#17263C]">{it.productName}</p>
                  <p className="text-[#758195]">
                    Sold: {it.quantity} {it.unit} · Remaining returnable: {remaining} {it.unit}
                  </p>
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={qtyMap[it.id] || ""}
                  onChange={(e) => {
                    const clean = sanitizeDecimalInput(e.target.value, 3);
                    if (clean === null) return;
                    setQtyMap((prev) => ({ ...prev, [it.id]: clean }));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace" || e.key === "Delete") {
                      e.stopPropagation();
                    }
                  }}
                  placeholder="0"
                  disabled={remaining <= 0}
                  className="w-24 min-h-[38px] px-2 border border-[#E6EAE9] rounded-lg text-right font-mono-num focus:outline-none focus:border-[#147D75]"
                />
              </div>
            );
          })}
        </div>

        <label className="flex items-center gap-2 text-xs text-[#17263C] cursor-pointer">
          <input
            type="checkbox"
            checked={restock}
            onChange={(e) => setRestock(e.target.checked)}
            className="w-4 h-4 accent-[#147D75]"
          />
          Restock returned items back into available inventory
        </label>

        <div>
          <FieldLabel label="Return Reason" required />
          <TextInput value={reason} onChange={(e) => setReason(e.target.value)} required />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-[#E6EAE9]">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Processing..." : "Confirm Return"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function CancelSaleModal({
  sale,
  currency,
  onClose,
  onConfirm,
}: {
  sale: Sale;
  currency: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("Voided by manager/owner");
  const [busy, setBusy] = useState(false);

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={`Cancel & Reverse ${sale.receiptNumber}`}
      subtitle="Completed financial transactions are never deleted; cancelling reverses stock and reports once with an audit entry."
    >
      <div className="space-y-4">
        <p className="text-xs text-[#758195]">
          Sale Total: <span className="font-mono-num font-semibold text-[#17263C]">{formatCurrency(sale.totalAmount, currency)}</span>
        </p>
        <div>
          <FieldLabel label="Reason for Cancellation" required />
          <TextInput value={reason} onChange={(e) => setReason(e.target.value)} required />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-[#E6EAE9]">
          <Button type="button" variant="secondary" onClick={onClose}>
            Keep Sale
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={busy || !reason.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(reason.trim());
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Reversing..." : "Reverse & Cancel Sale"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
