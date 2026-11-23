import React, { useMemo, useState } from "react";
import { Edit3, Plus, Trash2, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useStore } from "../context/StoreContext";
import { formatCurrency, formatDateDisplay, roundMoney, toLocalDateKey } from "../lib/finance";
import { deleteExpenseRecord, makeId, saveExpense } from "../lib/storeService";
import {
  EXPENSE_CATEGORIES,
  type Expense,
  type ExpenseCategory,
  type SimplePaymentMethod,
} from "../types/retail";
import {
  Button,
  EmptyState,
  FieldLabel,
  Modal,
  SelectInput,
  TextInput,
} from "../components/ui/Primitives";

export function ExpensesPage() {
  const {
    activeBusiness,
    userRole,
    isSampleMode,
    expenses,
    showToast,
    updateSampleBundle,
  } = useStore();

  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [monthFilter, setMonthFilter] = useState(toLocalDateKey().slice(0, 7));
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  const currency = activeBusiness?.currency || "INR";
  const canManage = userRole === "OWNER" || userRole === "MANAGER";

  const filtered = useMemo(() => {
    return [...expenses]
      .filter((e) => {
        if (categoryFilter !== "ALL" && e.category !== categoryFilter) return false;
        if (monthFilter && !e.expenseDate.startsWith(monthFilter)) return false;
        return true;
      })
      .sort((a, b) => b.expenseDate.localeCompare(a.expenseDate));
  }, [expenses, categoryFilter, monthFilter]);

  const totalFiltered = useMemo(
    () => roundMoney(filtered.reduce((s, e) => s + e.amount, 0)),
    [filtered]
  );

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of filtered) {
      map.set(e.category, roundMoney((map.get(e.category) || 0) + e.amount));
    }
    return Array.from(map.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [filtered]);

  const handleDelete = async (exp: Expense) => {
    if (!activeBusiness) return;
    if (isSampleMode) {
      updateSampleBundle((prev) => ({
        ...prev,
        expenses: prev.expenses.filter((x) => x.id !== exp.id),
      }));
      showToast("Expense removed from sample store.");
      return;
    }
    await deleteExpenseRecord(activeBusiness.id, exp.id);
    showToast("Expense deleted.");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#17263C]">Operating Expenses</h2>
          <p className="text-xs text-[#758195] mt-0.5">
            Track shop running costs (rent, wages, electricity). Inventory stock purchases are tracked separately so profit is never double-counted.
          </p>
        </div>

        {canManage && (
          <Button
            variant="accent"
            size="sm"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </Button>
        )}
      </div>

      {/* Filters & Monthly Total */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-[#E6EAE9] rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-2">
          <SelectInput
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="!w-auto !min-h-[38px] text-xs"
          >
            <option value="ALL">All Categories</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </SelectInput>
          <TextInput
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="!w-auto !min-h-[38px] text-xs"
          />
          {monthFilter && (
            <Button variant="ghost" size="sm" onClick={() => setMonthFilter("")}>
              All Time
            </Button>
          )}
        </div>

        <div className="text-right">
          <span className="text-xs text-[#758195] mr-2">Filtered Total</span>
          <span className="text-lg font-bold font-mono-num text-[#17263C]">
            {formatCurrency(totalFiltered, currency)}
          </span>
        </div>
      </div>

      {/* Category Breakdown Chart */}
      {byCategory.length > 0 && (
        <div className="bg-white border border-[#E6EAE9] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#17263C] mb-3">Expense Category Breakdown</h3>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCategory} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6EAE9" vertical={false} />
                <XAxis dataKey="category" tick={{ fontSize: 11, fill: "#758195" }} axisLine={{ stroke: "#E6EAE9" }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#758195" }} axisLine={false} tickLine={false} width={54} />
                <Tooltip
                  formatter={(v: unknown) => formatCurrency(Number(v || 0), currency)}
                  contentStyle={{ backgroundColor: "#FFFFFF", borderColor: "#E6EAE9", borderRadius: "8px", fontSize: "12px" }}
                />
                <Bar dataKey="amount" name="Amount" fill="#17263C" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Expense List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Wallet className="w-5 h-5" />}
          title="No expenses in this period"
          description="Record shop rent, electricity, wages, packaging, or delivery expenses to calculate accurate operating profit."
          action={
            canManage ? (
              <Button
                variant="accent"
                onClick={() => {
                  setEditing(null);
                  setModalOpen(true);
                }}
              >
                <Plus className="w-4 h-4" />
                Add First Expense
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
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Description</th>
                  <th className="py-3 px-3">Paid Via</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6EAE9] text-xs">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-[#F7F8F6]/60">
                    <td className="py-3 px-4 font-mono-num text-[#758195] whitespace-nowrap">
                      {formatDateDisplay(e.expenseDate, activeBusiness?.dateFormat)}
                    </td>
                    <td className="py-3 px-3 font-medium text-[#17263C]">{e.category}</td>
                    <td className="py-3 px-3 text-[#758195]">
                      {e.description}
                      {e.referenceNumber ? ` · Ref ${e.referenceNumber}` : ""}
                    </td>
                    <td className="py-3 px-3 text-[#758195]">{e.paymentMethod.replace("_", " ")}</td>
                    <td className="py-3 px-3 text-right font-mono-num font-semibold text-[#17263C]">
                      {formatCurrency(e.amount, currency)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(e);
                              setModalOpen(true);
                            }}
                            className="p-2 rounded-lg text-[#758195] hover:bg-[#F7F8F6] hover:text-[#17263C] cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                        {userRole === "OWNER" && (
                          <button
                            type="button"
                            onClick={() => handleDelete(e)}
                            className="p-2 rounded-lg text-[#758195] hover:bg-[#F7F8F6] hover:text-[#C84C4C] cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {modalOpen && activeBusiness && (
        <ExpenseModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          expense={editing}
          currency={currency}
          onSave={async (data) => {
            if (isSampleMode) {
              updateSampleBundle((prev) => {
                const id = editing?.id || makeId("exp");
                const rec: Expense = {
                  id,
                  businessId: prev.business.id,
                  ownerId: prev.business.ownerId,
                  memberUids: prev.business.memberUids,
                  ...data,
                };
                return {
                  ...prev,
                  expenses: editing
                    ? prev.expenses.map((x) => (x.id === id ? rec : x))
                    : [rec, ...prev.expenses],
                };
              });
              showToast(editing ? "Expense updated." : "Expense recorded.");
              setModalOpen(false);
              return;
            }
            await saveExpense({
              business: activeBusiness,
              expenseId: editing?.id,
              data,
            });
            showToast(editing ? "Expense updated." : "Expense recorded.");
            setModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

function ExpenseModal({
  open,
  onClose,
  expense,
  currency,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  expense: Expense | null;
  currency: string;
  onSave: (data: {
    category: ExpenseCategory;
    description: string;
    amount: number;
    paymentMethod: SimplePaymentMethod;
    expenseDate: string;
    referenceNumber?: string;
    notes?: string;
  }) => Promise<void>;
}) {
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category || "Rent");
  const [description, setDescription] = useState(expense?.description || "");
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [paymentMethod, setPaymentMethod] = useState<SimplePaymentMethod>(expense?.paymentMethod || "CASH");
  const [expenseDate, setExpenseDate] = useState(expense?.expenseDate || toLocalDateKey());
  const [referenceNumber, setReferenceNumber] = useState(expense?.referenceNumber || "");
  const [notes, setNotes] = useState(expense?.notes || "");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = roundMoney(Number(amount) || 0);
    if (amt <= 0 || !description.trim()) return;
    setBusy(true);
    try {
      await onSave({
        category,
        description: description.trim(),
        amount: amt,
        paymentMethod,
        expenseDate,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={expense ? "Edit Expense" : "Add Operating Expense"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel label="Category" required />
            <SelectInput value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectInput>
          </div>
          <div>
            <FieldLabel label={`Amount (${currency})`} required />
            <TextInput type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
        </div>
        <div>
          <FieldLabel label="Description" required />
          <TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Monthly shop rent" required />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel label="Date" required />
            <TextInput type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} required />
          </div>
          <div>
            <FieldLabel label="Payment Method" required />
            <SelectInput value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as SimplePaymentMethod)}>
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="CARD">Card</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
            </SelectInput>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel label="Reference / Receipt #" hint="Optional" />
            <TextInput value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
          </div>
          <div>
            <FieldLabel label="Notes" hint="Optional" />
            <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-[#E6EAE9]">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="accent" disabled={busy}>
            {busy ? "Saving..." : expense ? "Update Expense" : "Save Expense"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
