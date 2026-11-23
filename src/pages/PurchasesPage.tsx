import React, { useMemo, useState } from "react";
import { CheckCircle2, CreditCard, Plus, Trash2, Truck } from "lucide-react";
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
import {
  createPurchase,
  makeId,
  receiveExistingPurchase,
  recordPurchasePayment,
} from "../lib/storeService";
import type { Purchase, SimplePaymentMethod } from "../types/retail";
import {
  Button,
  EmptyState,
  FieldLabel,
  Modal,
  SelectInput,
  TextInput,
} from "../components/ui/Primitives";

export function PurchasesPage() {
  const {
    user,
    userProfile,
    activeBusiness,
    userRole,
    isSampleMode,
    purchases,
    purchaseItems,
    products,
    suppliers,
    showToast,
    updateSampleBundle,
    sampleReceivePurchase,
    sampleRecordPayment,
  } = useStore();

  const [createOpen, setCreateOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<Purchase | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");

  const currency = activeBusiness?.currency || "INR";
  const canManage = userRole === "OWNER" || userRole === "MANAGER";

  const filtered = useMemo(() => {
    return [...purchases]
      .filter((p) => (statusFilter === "ALL" ? true : p.status === statusFilter))
      .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));
  }, [purchases, statusFilter]);

  const totalPayables = useMemo(
    () =>
      roundMoney(
        purchases
          .filter((p) => p.status !== "CANCELLED")
          .reduce((sum, p) => sum + p.outstandingAmount, 0)
      ),
    [purchases]
  );

  const handleReceive = async (purchase: Purchase) => {
    if (!activeBusiness) return;
    if (isSampleMode) {
      sampleReceivePurchase(purchase.id);
      showToast(`Goods received for ${purchase.invoiceNumber}. Stock updated.`);
      return;
    }
    if (!user) return;
    try {
      const items = purchaseItems.filter((it) => it.purchaseId === purchase.id);
      await receiveExistingPurchase({
        business: activeBusiness,
        actorUid: user.uid,
        actorName: userProfile?.displayName || user.displayName || "Owner",
        purchaseId: purchase.id,
        purchaseItems: items,
      });
      showToast(`Goods received for ${purchase.invoiceNumber}. Inventory and weighted costs updated.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to receive goods.", "error");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#17263C]">Purchases & Stock Inward</h2>
          <p className="text-xs text-[#758195] mt-0.5">
            Stock increases only when goods are marked received. Open supplier payables:{" "}
            <span className="font-mono-num font-semibold text-[#C84C4C]">
              {formatCurrency(totalPayables, currency)}
            </span>
          </p>
        </div>

        {canManage && (
          <Button variant="accent" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" />
            Record Purchase
          </Button>
        )}
      </div>

      <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-white border border-[#E6EAE9] rounded-lg">
        {["ALL", "RECEIVED", "ORDERED", "DRAFT"].map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
              statusFilter === st ? "bg-[#17263C] text-white" : "text-[#758195] hover:text-[#17263C]"
            }`}
          >
            {st === "ALL" ? "All Bills" : st}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Truck className="w-5 h-5" />}
          title="No purchases recorded yet"
          description="Record supplier invoices to track costs, payables, and automatically restock inventory when goods arrive."
          action={
            canManage ? (
              <Button variant="accent" onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4" />
                Record First Purchase
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="bg-white border border-[#E6EAE9] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E6EAE9] bg-[#F7F8F6] text-[11px] font-semibold text-[#758195]">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Supplier</th>
                  <th className="py-3 px-3">Goods Status</th>
                  <th className="py-3 px-3">Payment</th>
                  <th className="py-3 px-3 text-right">Total</th>
                  <th className="py-3 px-3 text-right">Balance Due</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6EAE9] text-xs">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-[#F7F8F6]/60">
                    <td className="py-3 px-4 font-mono-num font-semibold text-[#17263C]">
                      {p.invoiceNumber}
                    </td>
                    <td className="py-3 px-3 font-mono-num text-[#758195]">
                      {formatDateDisplay(p.purchaseDate, activeBusiness?.dateFormat)}
                    </td>
                    <td className="py-3 px-3 text-[#17263C]">{p.supplierName}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`font-medium ${
                          p.stockReceived ? "text-[#21865B]" : "text-[#D99A31]"
                        }`}
                      >
                        {p.stockReceived ? "Received in stock" : p.status}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`font-medium ${
                          p.paymentStatus === "PAID"
                            ? "text-[#21865B]"
                            : p.paymentStatus === "PARTIAL"
                            ? "text-[#D99A31]"
                            : "text-[#C84C4C]"
                        }`}
                      >
                        {p.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono-num font-semibold text-[#17263C]">
                      {formatCurrency(p.totalAmount, currency)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-num text-[#C84C4C]">
                      {formatCurrency(p.outstandingAmount, currency)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        {!p.stockReceived && canManage && (
                          <Button size="sm" variant="accent" onClick={() => handleReceive(p)}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Receive Goods
                          </Button>
                        )}
                        {p.outstandingAmount > 0 && canManage && (
                          <Button size="sm" variant="secondary" onClick={() => setPayTarget(p)}>
                            <CreditCard className="w-3.5 h-3.5" />
                            Pay
                          </Button>
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

      {/* Create Purchase Modal */}
      {createOpen && activeBusiness && (
        <NewPurchaseModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          products={products.filter((p) => p.isActive)}
          suppliers={suppliers}
          currency={currency}
          onSubmit={async (payload) => {
            if (isSampleMode) {
              updateSampleBundle((prev) => {
                const purId = makeId("pur");
                const subtotal = roundMoney(
                  payload.items.reduce((s, it) => s + it.quantity * it.unitCost, 0)
                );
                const tax = roundMoney(payload.items.reduce((s, it) => s + it.taxAmount, 0));
                const total = Math.max(0, roundMoney(subtotal - payload.discountAmount + tax));
                const paid = Math.min(total, payload.amountPaid);
                const out = roundMoney(total - paid);
                const newPur: Purchase = {
                  id: purId,
                  businessId: prev.business.id,
                  ownerId: prev.business.ownerId,
                  memberUids: prev.business.memberUids,
                  supplierId: payload.supplierId,
                  supplierName: payload.supplierName,
                  invoiceNumber: payload.invoiceNumber,
                  purchaseDate: payload.purchaseDate,
                  subtotal,
                  taxAmount: tax,
                  discountAmount: payload.discountAmount,
                  totalAmount: total,
                  amountPaid: paid,
                  outstandingAmount: out,
                  paymentStatus: paid <= 0 ? "UNPAID" : out <= 0 ? "PAID" : "PARTIAL",
                  status: payload.receiveNow ? "RECEIVED" : "ORDERED",
                  stockReceived: payload.receiveNow,
                  notes: payload.notes,
                };
                const newItems = payload.items.map((it) => ({
                  id: makeId("pit"),
                  businessId: prev.business.id,
                  ownerId: prev.business.ownerId,
                  memberUids: prev.business.memberUids,
                  purchaseId: purId,
                  productId: it.productId,
                  productName: it.productName,
                  unit: it.unit,
                  quantity: it.quantity,
                  unitCost: it.unitCost,
                  taxAmount: it.taxAmount,
                  lineTotal: roundMoney(it.quantity * it.unitCost + it.taxAmount),
                }));
                let nextProducts = prev.products;
                if (payload.receiveNow) {
                  nextProducts = prev.products.map((pr) => {
                    const match = payload.items.filter((i) => i.productId === pr.id);
                    if (match.length === 0) return pr;
                    const addedQty = match.reduce((s, m) => s + m.quantity, 0);
                    return { ...pr, currentStock: roundQty(pr.currentStock + addedQty) };
                  });
                }
                return {
                  ...prev,
                  products: nextProducts,
                  purchases: [newPur, ...prev.purchases],
                  purchaseItems: [...newItems, ...prev.purchaseItems],
                };
              });
              showToast("Purchase recorded in sample store.");
              setCreateOpen(false);
              return;
            }
            if (!user) return;
            await createPurchase({
              business: activeBusiness,
              actorUid: user.uid,
              actorName: userProfile?.displayName || user.displayName || "Owner",
              ...payload,
            });
            showToast(
              payload.receiveNow
                ? "Purchase recorded and stock updated!"
                : "Purchase order saved (stock unchanged until received)."
            );
            setCreateOpen(false);
          }}
        />
      )}

      {/* Supplier Payment Modal */}
      {payTarget && activeBusiness && (
        <Modal
          open={true}
          onClose={() => setPayTarget(null)}
          title={`Pay Supplier — ${payTarget.invoiceNumber}`}
          subtitle={`${payTarget.supplierName} · Balance due: ${formatCurrency(payTarget.outstandingAmount, currency)}`}
        >
          <PurchasePaymentForm
            maxAmount={payTarget.outstandingAmount}
            currency={currency}
            onCancel={() => setPayTarget(null)}
            onSubmit={async (amount, method, notes) => {
              if (isSampleMode) {
                sampleRecordPayment(
                  "SUPPLIER",
                  payTarget.supplierId || payTarget.id,
                  amount,
                  method,
                  payTarget.id
                );
                showToast("Supplier payment recorded.");
                setPayTarget(null);
                return;
              }
              if (!user) return;
              await recordPurchasePayment({
                business: activeBusiness,
                actorUid: user.uid,
                actorName: userProfile?.displayName || user.displayName || "Owner",
                purchaseId: payTarget.id,
                amount,
                paymentMethod: method,
                notes,
              });
              showToast("Payment recorded against supplier bill.");
              setPayTarget(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function NewPurchaseModal({
  open,
  onClose,
  products,
  suppliers,
  currency,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  products: Array<{ id: string; name: string; unit: string; purchaseCost: number }>;
  suppliers: Array<{ id: string; name: string }>;
  currency: string;
  onSubmit: (payload: {
    supplierId?: string;
    supplierName: string;
    invoiceNumber: string;
    purchaseDate: string;
    items: Array<{
      productId: string;
      productName: string;
      unit: string;
      quantity: number;
      unitCost: number;
      taxAmount: number;
    }>;
    discountAmount: number;
    amountPaid: number;
    receiveNow: boolean;
    notes?: string;
  }) => Promise<void>;
}) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || "");
  const [customSupplier, setCustomSupplier] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState(`PUR-${Math.floor(1000 + Math.random() * 9000)}`);
  const [purchaseDate, setPurchaseDate] = useState(toLocalDateKey());
  const [lines, setLines] = useState<
    Array<{ rowId: string; productId: string; quantity: string; unitCost: string; taxAmount: string }>
  >(
    products[0]
      ? [
          {
            rowId: makeId("prow"),
            productId: products[0].id,
            quantity: "10",
            unitCost: String(products[0].purchaseCost),
            taxAmount: "0",
          },
        ]
      : []
  );
  const [discountAmount, setDiscountAmount] = useState("0");
  const [amountPaid, setAmountPaid] = useState("0");
  const [receiveNow, setReceiveNow] = useState(true);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const totalCalc = useMemo(() => {
    const sub = lines.reduce(
      (s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0),
      0
    );
    const tax = lines.reduce((s, l) => s + (Number(l.taxAmount) || 0), 0);
    const disc = Number(discountAmount) || 0;
    return Math.max(0, roundMoney(sub - disc + tax));
  }, [lines, discountAmount]);

  const addLine = () => {
    if (!products[0]) return;
    setErr("");
    setLines((prev) => [
      ...prev,
      {
        rowId: makeId("prow"),
        productId: products[0].id,
        quantity: "1",
        unitCost: String(products[0].purchaseCost),
        taxAmount: "0",
      },
    ]);
  };

  const updateLine = (
    rowId: string,
    patch: Partial<{ productId: string; quantity: string; unitCost: string; taxAmount: string }>
  ) => {
    setErr("");
    setLines((prev) => prev.map((l) => (l.rowId === rowId ? { ...l, ...patch } : l)));
  };

  const removeLine = (rowId: string) => {
    setErr("");
    setLines((prev) => prev.filter((l) => l.rowId !== rowId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supName =
      suppliers.find((s) => s.id === supplierId)?.name || customSupplier.trim();
    if (!supName) {
      setErr("Select a supplier or enter supplier name.");
      return;
    }
    if (lines.length === 0) {
      setErr("Add at least one product row to record a purchase.");
      return;
    }

    const items: Array<{
      productId: string;
      productName: string;
      unit: string;
      quantity: number;
      unitCost: number;
      taxAmount: number;
    }> = [];

    for (const l of lines) {
      const prod = products.find((p) => p.id === l.productId);
      if (!prod) {
        setErr("Select a valid product for every row.");
        return;
      }
      const qty = parsePositiveQty(l.quantity);
      if (qty === null) {
        setErr(`Enter a valid quantity greater than 0 for "${prod.name}".`);
        return;
      }
      const costNum = Number(l.unitCost || "0");
      const taxNum = Number(l.taxAmount || "0");
      if (!Number.isFinite(costNum) || costNum < 0) {
        setErr(`Unit cost cannot be negative for "${prod.name}".`);
        return;
      }
      if (!Number.isFinite(taxNum) || taxNum < 0) {
        setErr(`Tax cannot be negative for "${prod.name}".`);
        return;
      }
      items.push({
        productId: prod.id,
        productName: prod.name,
        unit: prod.unit,
        quantity: qty,
        unitCost: roundMoney(costNum),
        taxAmount: roundMoney(taxNum),
      });
    }

    setBusy(true);
    setErr("");
    try {
      await onSubmit({
        supplierId: supplierId || undefined,
        supplierName: supName,
        invoiceNumber: invoiceNumber.trim() || `PUR-${Date.now()}`,
        purchaseDate,
        items,
        discountAmount: Math.max(0, roundMoney(Number(discountAmount) || 0)),
        amountPaid: Math.max(0, roundMoney(Number(amountPaid) || 0)),
        receiveNow,
        notes: notes.trim() || undefined,
      });
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Failed to save purchase.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record Purchase"
      subtitle="Add supplier invoice details and products."
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {err && <div className="p-3 rounded-lg bg-[#C84C4C]/10 text-xs text-[#C84C4C]">{err}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel label="Supplier" required />
            <SelectInput value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">Enter supplier name manually</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectInput>
          </div>
          {!supplierId ? (
            <div>
              <FieldLabel label="Supplier Name" required />
              <TextInput
                value={customSupplier}
                onChange={(e) => setCustomSupplier(e.target.value)}
                placeholder="Wholesale vendor name"
                required
              />
            </div>
          ) : (
            <div>
              <FieldLabel label="Invoice Number" required />
              <TextInput value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} required />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {!supplierId && (
            <div>
              <FieldLabel label="Invoice Number" required />
              <TextInput value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} required />
            </div>
          )}
          <div>
            <FieldLabel label="Purchase Date" required />
            <TextInput type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} required />
          </div>
        </div>

        {/* Purchase Line Items */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#17263C]">Products Purchased</span>
            <Button type="button" size="sm" variant="secondary" onClick={addLine} disabled={products.length === 0}>
              <Plus className="w-3.5 h-3.5" />
              Add Row
            </Button>
          </div>

          {products.length === 0 ? (
            <p className="text-xs text-[#C84C4C]">Add products in Products & Inventory before recording a purchase.</p>
          ) : (
            <div className="space-y-2">
              {lines.map((line) => {
                const rowQty = Number(line.quantity) || 0;
                const rowCost = Number(line.unitCost) || 0;
                const rowTax = Number(line.taxAmount) || 0;
                const rowLineTotal = roundMoney(rowQty * rowCost + rowTax);
                return (
                  <div key={line.rowId} className="grid grid-cols-12 gap-2 items-end p-2.5 bg-[#F7F8F6] rounded-lg border border-[#E6EAE9]">
                    <div className="col-span-12 sm:col-span-4">
                      <FieldLabel label="Product" />
                      <SelectInput
                        value={line.productId}
                        onChange={(e) => {
                          const prod = products.find((p) => p.id === e.target.value);
                          updateLine(line.rowId, {
                            productId: e.target.value,
                            unitCost: String(prod?.purchaseCost ?? 0),
                          });
                        }}
                        className="!min-h-[38px] text-xs"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.unit})
                          </option>
                        ))}
                      </SelectInput>
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <FieldLabel label="Qty" />
                      <TextInput
                        type="text"
                        inputMode="decimal"
                        value={line.quantity}
                        onChange={(e) => {
                          const clean = sanitizeDecimalInput(e.target.value, 3);
                          if (clean !== null) updateLine(line.rowId, { quantity: clean });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Backspace" || e.key === "Delete") e.stopPropagation();
                        }}
                        placeholder="0"
                        className="!min-h-[38px] text-xs font-mono-num"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <FieldLabel label="Unit Cost" />
                      <TextInput
                        type="text"
                        inputMode="decimal"
                        value={line.unitCost}
                        onChange={(e) => {
                          const clean = sanitizeDecimalInput(e.target.value, 2);
                          if (clean !== null) updateLine(line.rowId, { unitCost: clean });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Backspace" || e.key === "Delete") e.stopPropagation();
                        }}
                        placeholder="0"
                        className="!min-h-[38px] text-xs font-mono-num"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <FieldLabel label="Tax" />
                      <TextInput
                        type="text"
                        inputMode="decimal"
                        value={line.taxAmount}
                        onChange={(e) => {
                          const clean = sanitizeDecimalInput(e.target.value, 2);
                          if (clean !== null) updateLine(line.rowId, { taxAmount: clean });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Backspace" || e.key === "Delete") e.stopPropagation();
                        }}
                        placeholder="0"
                        className="!min-h-[38px] text-xs font-mono-num"
                      />
                    </div>
                    <div className="col-span-10 sm:col-span-1 text-right self-center pt-4">
                      <span className="text-[11px] font-mono-num font-semibold text-[#17263C]">
                        {formatCurrency(rowLineTotal, currency)}
                      </span>
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeLine(line.rowId)}
                        aria-label="Remove purchase row"
                        className="p-2 text-[#758195] hover:text-[#C84C4C] cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              className="font-mono-num"
            />
          </div>
          <div>
            <FieldLabel label={`Amount Paid Now (${currency})`} />
            <TextInput
              type="text"
              inputMode="decimal"
              value={amountPaid}
              onChange={(e) => {
                const clean = sanitizeDecimalInput(e.target.value, 2);
                if (clean !== null) setAmountPaid(clean);
              }}
              onKeyDown={(e) => {
                if (e.key === "Backspace" || e.key === "Delete") e.stopPropagation();
              }}
              placeholder="0"
              className="font-mono-num"
            />
          </div>
          <div className="flex flex-col justify-center p-3 rounded-lg bg-[#F7F8F6] border border-[#E6EAE9]">
            <span className="text-[11px] text-[#758195]">Bill Total</span>
            <span className="text-base font-bold font-mono-num text-[#17263C]">
              {formatCurrency(totalCalc, currency)}
            </span>
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-[#17263C] cursor-pointer">
          <input
            type="checkbox"
            checked={receiveNow}
            onChange={(e) => setReceiveNow(e.target.checked)}
            className="w-4 h-4 accent-[#147D75]"
          />
          Goods have arrived now — add quantities to available stock & update average cost
        </label>

        <div>
          <FieldLabel label="Notes" hint="Optional" />
          <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="pt-3 border-t border-[#E6EAE9] flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="accent" disabled={busy}>
            {busy ? "Saving..." : receiveNow ? "Save & Receive Stock" : "Save Purchase Order"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function PurchasePaymentForm({
  maxAmount,
  currency,
  onCancel,
  onSubmit,
}: {
  maxAmount: number;
  currency: string;
  onCancel: () => void;
  onSubmit: (amount: number, method: SimplePaymentMethod, notes: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState(String(maxAmount));
  const [method, setMethod] = useState<SimplePaymentMethod>("UPI");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSubmit(Math.min(maxAmount, Number(amount) || 0), method, notes);
        } finally {
          setBusy(false);
        }
      }}
      className="space-y-4"
    >
      <div>
        <FieldLabel label={`Payment Amount (${currency})`} required />
        <TextInput
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            const clean = sanitizeDecimalInput(e.target.value, 2);
            if (clean !== null) setAmount(clean);
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" || e.key === "Delete") e.stopPropagation();
          }}
          className="font-mono-num"
          required
        />
      </div>
      <div>
        <FieldLabel label="Payment Method" required />
        <SelectInput value={method} onChange={(e) => setMethod(e.target.value as SimplePaymentMethod)}>
          <option value="CASH">Cash</option>
          <option value="UPI">UPI</option>
          <option value="BANK_TRANSFER">Bank Transfer</option>
          <option value="CARD">Card</option>
        </SelectInput>
      </div>
      <div>
        <FieldLabel label="Reference / Note" />
        <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="UPI ref or receipt note" />
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-[#E6EAE9]">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="accent" disabled={busy}>
          {busy ? "Recording..." : "Record Payment"}
        </Button>
      </div>
    </form>
  );
}
