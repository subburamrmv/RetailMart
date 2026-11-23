import React, { useMemo, useState } from "react";
import { CreditCard, Edit3, Plus, Search, Store } from "lucide-react";
import { useStore } from "../context/StoreContext";
import { formatCurrency, formatDateDisplay, roundMoney } from "../lib/finance";
import { makeId, recordSupplierDirectPayment, saveSupplier } from "../lib/storeService";
import type { SimplePaymentMethod, Supplier } from "../types/retail";
import {
  Button,
  EmptyState,
  FieldLabel,
  Modal,
  SelectInput,
  TextInput,
} from "../components/ui/Primitives";

export function SuppliersPage() {
  const {
    user,
    userProfile,
    activeBusiness,
    userRole,
    isSampleMode,
    suppliers,
    purchases,
    products,
    showToast,
    updateSampleBundle,
    sampleRecordPayment,
  } = useStore();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [detailSupplier, setDetailSupplier] = useState<Supplier | null>(null);
  const [paySupplier, setPaySupplier] = useState<Supplier | null>(null);

  const currency = activeBusiness?.currency || "INR";
  const canManage = userRole === "OWNER" || userRole === "MANAGER";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return suppliers
      .filter(
        (s) =>
          !q ||
          s.name.toLowerCase().includes(q) ||
          (s.contactPerson || "").toLowerCase().includes(q) ||
          (s.phone || "").toLowerCase().includes(q)
      )
      .sort((a, b) => b.outstandingPayable - a.outstandingPayable || a.name.localeCompare(b.name));
  }, [suppliers, search]);

  const totalPayables = useMemo(
    () => roundMoney(suppliers.reduce((s, x) => s + x.outstandingPayable, 0)),
    [suppliers]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#17263C]">Suppliers Directory</h2>
          <p className="text-xs text-[#758195] mt-0.5">
            Track wholesale vendors, products supplied, and outstanding supplier payables:{" "}
            <span className="font-mono-num font-semibold text-[#C84C4C]">
              {formatCurrency(totalPayables, currency)}
            </span>
          </p>
        </div>

        {canManage && (
          <Button
            variant="accent"
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="w-4 h-4" />
            Add Supplier
          </Button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 text-[#758195] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <TextInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search supplier name, contact, phone..."
          className="pl-10 !min-h-[40px] text-xs"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Store className="w-5 h-5" />}
          title="No suppliers added yet"
          description="Add your wholesalers and distributors to track purchase history and open balances."
          action={
            canManage ? (
              <Button
                variant="accent"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="w-4 h-4" />
                Add First Supplier
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
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-3">Contact</th>
                  <th className="py-3 px-3 text-right">Total Purchases</th>
                  <th className="py-3 px-3 text-right">Outstanding Payable</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6EAE9] text-xs">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-[#F7F8F6]/60">
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => setDetailSupplier(s)}
                        className="font-semibold text-[#17263C] hover:text-[#147D75] text-left cursor-pointer"
                      >
                        {s.name}
                      </button>
                      {s.address && <p className="text-[11px] text-[#758195]">{s.address}</p>}
                    </td>
                    <td className="py-3 px-3 text-[#758195]">
                      {s.contactPerson || "—"} {s.phone ? `· ${s.phone}` : ""}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-num text-[#17263C]">
                      {formatCurrency(s.totalPurchases, currency)}
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-mono-num font-semibold ${
                        s.outstandingPayable > 0 ? "text-[#C84C4C]" : "text-[#21865B]"
                      }`}
                    >
                      {formatCurrency(s.outstandingPayable, currency)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {s.outstandingPayable > 0 && canManage && (
                          <Button size="sm" variant="secondary" onClick={() => setPaySupplier(s)}>
                            <CreditCard className="w-3.5 h-3.5" />
                            Pay
                          </Button>
                        )}
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(s);
                              setFormOpen(true);
                            }}
                            className="p-2 rounded-lg text-[#758195] hover:bg-[#F7F8F6] hover:text-[#17263C] cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
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

      {formOpen && activeBusiness && (
        <SupplierFormModal
          supplier={editing}
          onClose={() => setFormOpen(false)}
          onSave={async (data) => {
            if (isSampleMode) {
              updateSampleBundle((prev) => {
                const id = editing?.id || makeId("sup");
                const rec: Supplier = {
                  id,
                  businessId: prev.business.id,
                  ownerId: prev.business.ownerId,
                  memberUids: prev.business.memberUids,
                  ...data,
                  totalPurchases: editing?.totalPurchases || 0,
                  outstandingPayable: editing?.outstandingPayable || 0,
                };
                return {
                  ...prev,
                  suppliers: editing
                    ? prev.suppliers.map((x) => (x.id === id ? rec : x))
                    : [rec, ...prev.suppliers],
                };
              });
              showToast(editing ? "Supplier updated." : "Supplier added.");
              setFormOpen(false);
              return;
            }
            await saveSupplier({ business: activeBusiness, supplierId: editing?.id, data });
            showToast(editing ? "Supplier updated." : "Supplier added.");
            setFormOpen(false);
          }}
        />
      )}

      {detailSupplier && (
        <Modal
          open={true}
          onClose={() => setDetailSupplier(null)}
          title={detailSupplier.name}
          subtitle={`Outstanding payable: ${formatCurrency(detailSupplier.outstandingPayable, currency)}`}
          maxWidth="max-w-xl"
        >
          <div className="space-y-4 text-xs">
            <div>
              <h4 className="font-semibold text-[#17263C] mb-1.5">Products Supplied</h4>
              <div className="border border-[#E6EAE9] rounded-lg divide-y divide-[#E6EAE9]">
                {products.filter((p) => p.supplierId === detailSupplier.id).length === 0 ? (
                  <p className="p-3 text-[#758195]">No products linked to this supplier yet.</p>
                ) : (
                  products
                    .filter((p) => p.supplierId === detailSupplier.id)
                    .map((p) => (
                      <div key={p.id} className="px-3 py-2 flex justify-between">
                        <span>{p.name}</span>
                        <span className="font-mono-num text-[#758195]">
                          {p.currentStock} {p.unit}
                        </span>
                      </div>
                    ))
                )}
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-[#17263C] mb-1.5">Purchase History</h4>
              <div className="border border-[#E6EAE9] rounded-lg divide-y divide-[#E6EAE9]">
                {purchases.filter((p) => p.supplierId === detailSupplier.id).length === 0 ? (
                  <p className="p-3 text-[#758195]">No purchases linked to this supplier yet.</p>
                ) : (
                  purchases
                    .filter((p) => p.supplierId === detailSupplier.id)
                    .map((p) => (
                      <div key={p.id} className="px-3 py-2 flex justify-between">
                        <span>
                          {p.invoiceNumber} · {formatDateDisplay(p.purchaseDate, activeBusiness?.dateFormat)}
                        </span>
                        <span className="font-mono-num font-semibold">
                          {formatCurrency(p.totalAmount, currency)}
                        </span>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {paySupplier && activeBusiness && (
        <SupplierPaymentModal
          supplier={paySupplier}
          currency={currency}
          onClose={() => setPaySupplier(null)}
          onSubmit={async (amount, method, notes) => {
            if (isSampleMode) {
              sampleRecordPayment("SUPPLIER", paySupplier.id, amount, method);
              showToast("Supplier payment recorded.");
              setPaySupplier(null);
              return;
            }
            if (!user) return;
            await recordSupplierDirectPayment({
              business: activeBusiness,
              actorUid: user.uid,
              actorName: userProfile?.displayName || user.displayName || "Owner",
              supplierId: paySupplier.id,
              amount,
              paymentMethod: method,
              notes,
            });
            showToast("Supplier payment recorded.");
            setPaySupplier(null);
          }}
        />
      )}
    </div>
  );
}

function SupplierFormModal({
  supplier,
  onClose,
  onSave,
}: {
  supplier: Supplier | null;
  onClose: () => void;
  onSave: (data: {
    name: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    address?: string;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(supplier?.name || "");
  const [contactPerson, setContactPerson] = useState(supplier?.contactPerson || "");
  const [phone, setPhone] = useState(supplier?.phone || "");
  const [email, setEmail] = useState(supplier?.email || "");
  const [address, setAddress] = useState(supplier?.address || "");
  const [busy, setBusy] = useState(false);

  return (
    <Modal open={true} onClose={onClose} title={supplier ? "Edit Supplier" : "Add Supplier"}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          setBusy(true);
          try {
            await onSave({
              name: name.trim(),
              contactPerson: contactPerson.trim() || undefined,
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
          <FieldLabel label="Supplier / Company Name" required />
          <TextInput value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel label="Contact Person" hint="Optional" />
            <TextInput value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
          </div>
          <div>
            <FieldLabel label="Phone" hint="Optional" />
            <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <div>
          <FieldLabel label="Email" hint="Optional" />
          <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
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
            {busy ? "Saving..." : "Save Supplier"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function SupplierPaymentModal({
  supplier,
  currency,
  onClose,
  onSubmit,
}: {
  supplier: Supplier;
  currency: string;
  onClose: () => void;
  onSubmit: (amount: number, method: SimplePaymentMethod, notes: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState(String(supplier.outstandingPayable));
  const [method, setMethod] = useState<SimplePaymentMethod>("UPI");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={`Pay Supplier — ${supplier.name}`}
      subtitle={`Outstanding payable: ${formatCurrency(supplier.outstandingPayable, currency)}`}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onSubmit(Math.min(supplier.outstandingPayable, Number(amount) || 0), method, notes);
          } finally {
            setBusy(false);
          }
        }}
        className="space-y-4"
      >
        <div>
          <FieldLabel label={`Payment Amount (${currency})`} required />
          <TextInput type="number" step="0.01" min="0.01" max={supplier.outstandingPayable} value={amount} onChange={(e) => setAmount(e.target.value)} required />
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
          <FieldLabel label="Reference / Note" hint="Optional" />
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
