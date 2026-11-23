import React, { useMemo, useState } from "react";
import { CreditCard, Edit3, Plus, Search, Users } from "lucide-react";
import { useStore } from "../context/StoreContext";
import { formatCurrency, formatDateDisplay, roundMoney } from "../lib/finance";
import { makeId, recordCustomerCreditPayment, saveCustomer } from "../lib/storeService";
import type { Customer, SimplePaymentMethod } from "../types/retail";
import {
  Button,
  EmptyState,
  FieldLabel,
  Modal,
  SelectInput,
  TextInput,
} from "../components/ui/Primitives";

export function CustomersPage() {
  const {
    user,
    userProfile,
    activeBusiness,
    isSampleMode,
    customers,
    sales,
    showToast,
    updateSampleBundle,
    sampleRecordPayment,
  } = useStore();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [payCustomer, setPayCustomer] = useState<Customer | null>(null);

  const currency = activeBusiness?.currency || "INR";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers
      .filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          (c.phone || "").toLowerCase().includes(q)
      )
      .sort((a, b) => b.outstandingCredit - a.outstandingCredit || a.name.localeCompare(b.name));
  }, [customers, search]);

  const totalReceivable = useMemo(
    () => roundMoney(customers.reduce((s, c) => s + c.outstandingCredit, 0)),
    [customers]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#17263C]">Customers & Credit Ledger</h2>
          <p className="text-xs text-[#758195] mt-0.5">
            Optional for walk-in sales. Total customer credit outstanding:{" "}
            <span className="font-mono-num font-semibold text-[#D99A31]">
              {formatCurrency(totalReceivable, currency)}
            </span>
          </p>
        </div>

        <Button
          variant="accent"
          size="sm"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="w-4 h-4" />
          Add Customer
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 text-[#758195] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <TextInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customer name or phone..."
          className="pl-10 !min-h-[40px] text-xs"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="w-5 h-5" />}
          title="No customers added yet"
          description="Add regular customers to track purchase history and pay-later credit balances. Walk-in cash sales never require registration."
          action={
            <Button
              variant="accent"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="w-4 h-4" />
              Add Customer
            </Button>
          }
        />
      ) : (
        <div className="bg-white border border-[#E6EAE9] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E6EAE9] bg-[#F7F8F6] text-[11px] font-semibold text-[#758195]">
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-3">Phone</th>
                  <th className="py-3 px-3 text-right">Total Purchases</th>
                  <th className="py-3 px-3 text-right">Credit Balance</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6EAE9] text-xs">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-[#F7F8F6]/60">
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => setHistoryCustomer(c)}
                        className="font-semibold text-[#17263C] hover:text-[#147D75] text-left cursor-pointer"
                      >
                        {c.name}
                      </button>
                      {c.address && <p className="text-[11px] text-[#758195]">{c.address}</p>}
                    </td>
                    <td className="py-3 px-3 font-mono-num text-[#758195]">{c.phone || "—"}</td>
                    <td className="py-3 px-3 text-right font-mono-num text-[#17263C]">
                      {formatCurrency(c.totalPurchases, currency)}
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-mono-num font-semibold ${
                        c.outstandingCredit > 0 ? "text-[#D99A31]" : "text-[#21865B]"
                      }`}
                    >
                      {formatCurrency(c.outstandingCredit, currency)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {c.outstandingCredit > 0 && (
                          <Button size="sm" variant="accent" onClick={() => setPayCustomer(c)}>
                            <CreditCard className="w-3.5 h-3.5" />
                            Receive
                          </Button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(c);
                            setFormOpen(true);
                          }}
                          className="p-2 rounded-lg text-[#758195] hover:bg-[#F7F8F6] hover:text-[#17263C] cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {formOpen && activeBusiness && (
        <CustomerFormModal
          customer={editing}
          onClose={() => setFormOpen(false)}
          onSave={async (data) => {
            if (isSampleMode) {
              updateSampleBundle((prev) => {
                const id = editing?.id || makeId("cus");
                const rec: Customer = {
                  id,
                  businessId: prev.business.id,
                  ownerId: prev.business.ownerId,
                  memberUids: prev.business.memberUids,
                  ...data,
                  totalPurchases: editing?.totalPurchases || 0,
                  outstandingCredit: editing?.outstandingCredit || 0,
                };
                return {
                  ...prev,
                  customers: editing
                    ? prev.customers.map((x) => (x.id === id ? rec : x))
                    : [rec, ...prev.customers],
                };
              });
              showToast(editing ? "Customer updated." : "Customer added.");
              setFormOpen(false);
              return;
            }
            await saveCustomer({ business: activeBusiness, customerId: editing?.id, data });
            showToast(editing ? "Customer updated." : "Customer added.");
            setFormOpen(false);
          }}
        />
      )}

      {historyCustomer && (
        <Modal
          open={true}
          onClose={() => setHistoryCustomer(null)}
          title={historyCustomer.name}
          subtitle={`Total purchases: ${formatCurrency(historyCustomer.totalPurchases, currency)} · Credit balance: ${formatCurrency(historyCustomer.outstandingCredit, currency)}`}
        >
          <div className="divide-y divide-[#E6EAE9] text-xs">
            {sales.filter((s) => s.customerId === historyCustomer.id).length === 0 ? (
              <p className="py-6 text-center text-[#758195]">No recorded sales linked to this customer yet.</p>
            ) : (
              sales
                .filter((s) => s.customerId === historyCustomer.id)
                .map((s) => (
                  <div key={s.id} className="py-2.5 flex justify-between">
                    <div>
                      <p className="font-mono-num font-semibold text-[#17263C]">{s.receiptNumber}</p>
                      <p className="text-[#758195]">
                        {formatDateDisplay(s.transactionDate, activeBusiness?.dateFormat)} · {s.paymentMethod}
                      </p>
                    </div>
                    <span className="font-mono-num font-semibold text-[#17263C]">
                      {formatCurrency(s.totalAmount, currency)}
                    </span>
                  </div>
                ))
            )}
          </div>
        </Modal>
      )}

      {payCustomer && activeBusiness && (
        <CustomerPaymentModal
          customer={payCustomer}
          currency={currency}
          onClose={() => setPayCustomer(null)}
          onSubmit={async (amount, method, notes) => {
            if (isSampleMode) {
              sampleRecordPayment("CUSTOMER", payCustomer.id, amount, method);
              showToast("Customer payment recorded.");
              setPayCustomer(null);
              return;
            }
            if (!user) return;
            await recordCustomerCreditPayment({
              business: activeBusiness,
              actorUid: user.uid,
              actorName: userProfile?.displayName || user.displayName || "Owner",
              customerId: payCustomer.id,
              amount,
              paymentMethod: method,
              notes,
            });
            showToast("Customer payment received and balance updated.");
            setPayCustomer(null);
          }}
        />
      )}
    </div>
  );
}

function CustomerFormModal({
  customer,
  onClose,
  onSave,
}: {
  customer: Customer | null;
  onClose: () => void;
  onSave: (data: { name: string; phone?: string; email?: string; address?: string }) => Promise<void>;
}) {
  const [name, setName] = useState(customer?.name || "");
  const [phone, setPhone] = useState(customer?.phone || "");
  const [email, setEmail] = useState(customer?.email || "");
  const [address, setAddress] = useState(customer?.address || "");
  const [busy, setBusy] = useState(false);

  return (
    <Modal open={true} onClose={onClose} title={customer ? "Edit Customer" : "Add Customer"}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          setBusy(true);
          try {
            await onSave({
              name: name.trim(),
              phone: phone.trim() || undefined,
              email: email.trim() || undefined,
              address: address.trim() || undefined,
            });
          } finally {
            setBusy(false);
          }
        }}
        className="space-y-4"
      >
        <div>
          <FieldLabel label="Customer Name" required />
          <TextInput value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel label="Phone" hint="Optional" />
            <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <FieldLabel label="Email" hint="Optional" />
            <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <div>
          <FieldLabel label="Address" hint="Optional" />
          <TextInput value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-[#E6EAE9]">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="accent" disabled={busy}>
            {busy ? "Saving..." : "Save Customer"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function CustomerPaymentModal({
  customer,
  currency,
  onClose,
  onSubmit,
}: {
  customer: Customer;
  currency: string;
  onClose: () => void;
  onSubmit: (amount: number, method: SimplePaymentMethod, notes: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState(String(customer.outstandingCredit));
  const [method, setMethod] = useState<SimplePaymentMethod>("CASH");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={`Receive Credit Payment — ${customer.name}`}
      subtitle={`Outstanding balance: ${formatCurrency(customer.outstandingCredit, currency)}`}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onSubmit(Math.min(customer.outstandingCredit, Number(amount) || 0), method, notes);
          } finally {
            setBusy(false);
          }
        }}
        className="space-y-4"
      >
        <div>
          <FieldLabel label={`Amount Received (${currency})`} required />
          <TextInput type="number" step="0.01" min="0.01" max={customer.outstandingCredit} value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div>
          <FieldLabel label="Payment Method" required />
          <SelectInput value={method} onChange={(e) => setMethod(e.target.value as SimplePaymentMethod)}>
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="CARD">Card</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
          </SelectInput>
        </div>
        <div>
          <FieldLabel label="Note" hint="Optional" />
          <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-[#E6EAE9]">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="accent" disabled={busy}>
            {busy ? "Recording..." : "Record Payment"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
