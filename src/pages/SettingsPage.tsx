import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  Copy,
  Download,
  Lock,
  Plus,
  RefreshCw,
  Shield,
  Sparkles,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useStore } from "../context/StoreContext";
import { updateBusinessMembers, updateBusinessSettings, upsertUserProfile } from "../lib/storeService";
import {
  BUSINESS_CATEGORIES,
  CURRENCY_OPTIONS,
  type BusinessCategory,
  type BusinessRole,
  type DateFormatOption,
  type LanguageCode,
} from "../types/retail";
import { Button, FieldLabel, SelectInput, TextInput } from "../components/ui/Primitives";

export function SettingsPage({
  onOpenNewBusiness,
}: {
  onOpenNewBusiness: () => void;
}) {
  const {
    user,
    activeBusiness,
    userRole,
    isSampleMode,
    isOnline,
    pendingOfflineSales,
    syncOfflineSales,
    resetSampleData,
    clearSampleMode,
    updateSampleBundle,
    products,
    variants,
    sales,
    saleItems,
    purchases,
    expenses,
    customers,
    suppliers,
    payments,
    showToast,
  } = useStore();

  const isOwner = userRole === "OWNER";

  const [name, setName] = useState(activeBusiness?.name || "");
  const [ownerName, setOwnerName] = useState(activeBusiness?.ownerName || "");
  const [category, setCategory] = useState<BusinessCategory>(activeBusiness?.category || "Grocery");
  const [phone, setPhone] = useState(activeBusiness?.phone || "");
  const [email, setEmail] = useState(activeBusiness?.email || "");
  const [address, setAddress] = useState(activeBusiness?.address || "");
  const [country, setCountry] = useState(activeBusiness?.country || "India");
  const [currency, setCurrency] = useState(activeBusiness?.currency || "INR");
  const [language, setLanguage] = useState<LanguageCode>(activeBusiness?.language || "en");
  const [dateFormat, setDateFormat] = useState<DateFormatOption>(activeBusiness?.dateFormat || "DD/MM/YYYY");
  const [fyStart, setFyStart] = useState<number>(activeBusiness?.financialYearStartMonth || 4);
  const [taxEnabled, setTaxEnabled] = useState<boolean>(Boolean(activeBusiness?.taxEnabled));
  const [defaultTaxRate, setDefaultTaxRate] = useState<string>(String(activeBusiness?.defaultTaxRate || 0));
  const [receiptFooter, setReceiptFooter] = useState(activeBusiness?.receiptFooter || "Thank you for shopping with us!");
  const [lowStockAlerts, setLowStockAlerts] = useState<boolean>(activeBusiness?.lowStockAlertsEnabled !== false);
  const [dailyAlerts, setDailyAlerts] = useState<boolean>(activeBusiness?.dailySummaryAlertsEnabled !== false);
  const [saving, setSaving] = useState(false);

  // Team management (Owner only)
  const [newMemberUid, setNewMemberUid] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<"MANAGER" | "CASHIER">("CASHIER");
  const [updatingTeam, setUpdatingTeam] = useState(false);

  useEffect(() => {
    if (!activeBusiness) return;
    setName(activeBusiness.name);
    setOwnerName(activeBusiness.ownerName);
    setCategory(activeBusiness.category);
    setPhone(activeBusiness.phone || "");
    setEmail(activeBusiness.email || "");
    setAddress(activeBusiness.address || "");
    setCountry(activeBusiness.country || "India");
    setCurrency(activeBusiness.currency || "INR");
    setLanguage(activeBusiness.language || "en");
    setDateFormat(activeBusiness.dateFormat || "DD/MM/YYYY");
    setFyStart(activeBusiness.financialYearStartMonth || 4);
    setTaxEnabled(Boolean(activeBusiness.taxEnabled));
    setDefaultTaxRate(String(activeBusiness.defaultTaxRate || 0));
    setReceiptFooter(activeBusiness.receiptFooter || "Thank you for shopping with us!");
    setLowStockAlerts(activeBusiness.lowStockAlertsEnabled !== false);
    setDailyAlerts(activeBusiness.dailySummaryAlertsEnabled !== false);
  }, [activeBusiness?.id]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness || !isOwner) return;
    if (!name.trim() || !ownerName.trim()) {
      showToast("Business name and owner name are required.", "error");
      return;
    }

    const updates = {
      name: name.trim(),
      ownerName: ownerName.trim(),
      category,
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      country: country.trim() || "India",
      currency,
      language,
      dateFormat,
      financialYearStartMonth: fyStart,
      taxEnabled,
      defaultTaxRate: Math.max(0, Math.min(100, Number(defaultTaxRate) || 0)),
      receiptFooter: receiptFooter.trim(),
      lowStockAlertsEnabled: lowStockAlerts,
      dailySummaryAlertsEnabled: dailyAlerts,
    };

    if (isSampleMode) {
      updateSampleBundle((prev) => ({
        ...prev,
        business: { ...prev.business, ...updates },
      }));
      showToast("Sample store settings updated.", "success");
      return;
    }

    setSaving(true);
    try {
      await updateBusinessSettings(activeBusiness.id, updates);
      if (user) {
        await upsertUserProfile({
          uid: user.uid,
          email: user.email || "",
          displayName: user.displayName || ownerName.trim(),
          preferredLanguage: language,
          activeBusinessId: activeBusiness.id,
        });
      }
      showToast("Business settings saved.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not save settings.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async () => {
    if (!activeBusiness || !isOwner || isSampleMode) return;
    const uid = newMemberUid.trim();
    if (!uid || !/^[a-zA-Z0-9_-]{4,128}$/.test(uid)) {
      showToast("Enter a valid Firebase User UID.", "error");
      return;
    }
    if (uid === activeBusiness.ownerId) {
      showToast("The owner already has full access.", "warning");
      return;
    }
    setUpdatingTeam(true);
    try {
      const nextUids = Array.from(new Set([...activeBusiness.memberUids, uid]));
      const nextRoles: Record<string, BusinessRole> = {
        ...activeBusiness.memberRoles,
        [uid]: newMemberRole,
      };
      await updateBusinessMembers({
        business: activeBusiness,
        memberUids: nextUids,
        memberRoles: nextRoles,
        productIds: products.map((p) => p.id),
        variantIds: variants.map((v) => v.id),
        customerIds: customers.map((c) => c.id),
        supplierIds: suppliers.map((s) => s.id),
        expenseIds: expenses.map((e) => e.id),
      });
      setNewMemberUid("");
      showToast(`Added ${newMemberRole} access for ${uid}.`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not update team members.", "error");
    } finally {
      setUpdatingTeam(false);
    }
  };

  const handleRemoveMember = async (uid: string) => {
    if (!activeBusiness || !isOwner || isSampleMode || uid === activeBusiness.ownerId) return;
    setUpdatingTeam(true);
    try {
      const nextUids = activeBusiness.memberUids.filter((id) => id !== uid);
      const nextRoles = { ...activeBusiness.memberRoles };
      delete nextRoles[uid];
      await updateBusinessMembers({
        business: activeBusiness,
        memberUids: nextUids,
        memberRoles: nextRoles,
        productIds: products.map((p) => p.id),
        variantIds: variants.map((v) => v.id),
        customerIds: customers.map((c) => c.id),
        supplierIds: suppliers.map((s) => s.id),
        expenseIds: expenses.map((e) => e.id),
      });
      showToast("Team member removed.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not remove member.", "error");
    } finally {
      setUpdatingTeam(false);
    }
  };

  const handleExportSnapshotJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      business: activeBusiness,
      products,
      variants,
      sales,
      saleItems,
      purchases,
      expenses,
      customers,
      suppliers,
      payments,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `retailmate-backup-${activeBusiness?.id || "store"}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Full store data exported as JSON.", "success");
  };

  const copyMyUid = async () => {
    if (!user?.uid) return;
    try {
      await navigator.clipboard.writeText(user.uid);
      showToast("Your User ID copied to clipboard.", "success");
    } catch {
      showToast("Copy failed — select and copy manually.", "warning");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {!isOwner && (
        <div className="bg-[#D99A31]/10 border border-[#D99A31]/30 rounded-xl px-4 py-3 flex items-center gap-2.5 text-xs text-[#17263C]">
          <Lock className="w-4 h-4 text-[#D99A31] shrink-0" />
          <span>
            You are signed in with <strong>{userRole}</strong> access. Business configuration and team permissions can only
            be changed by the store Owner.
          </span>
        </div>
      )}

      {/* Business Configuration Form */}
      <form onSubmit={handleSaveSettings} className="bg-white border border-[#E6EAE9] rounded-xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E6EAE9]">
          <div>
            <h2 className="text-base font-bold text-[#17263C]">Business & Receipt Settings</h2>
            <p className="text-xs text-[#758195] mt-0.5">
              Customize store details, tax behavior, regional format, and language
            </p>
          </div>
          {!isSampleMode && (
            <Button type="button" variant="secondary" size="sm" onClick={onOpenNewBusiness}>
              <Plus className="w-4 h-4" />
              Add Another Business
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel label="Business Name" required />
            <TextInput value={name} onChange={(e) => setName(e.target.value)} disabled={!isOwner} required />
          </div>
          <div>
            <FieldLabel label="Owner Name" required />
            <TextInput value={ownerName} onChange={(e) => setOwnerName(e.target.value)} disabled={!isOwner} required />
          </div>
          <div>
            <FieldLabel label="Business Category" />
            <SelectInput
              value={category}
              onChange={(e) => setCategory(e.target.value as BusinessCategory)}
              disabled={!isOwner}
            >
              {BUSINESS_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectInput>
          </div>
          <div>
            <FieldLabel label="Phone Number" />
            <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!isOwner} />
          </div>
          <div>
            <FieldLabel label="Business Email" />
            <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!isOwner} />
          </div>
          <div>
            <FieldLabel label="Country" />
            <TextInput value={country} onChange={(e) => setCountry(e.target.value)} disabled={!isOwner} />
          </div>
        </div>

        <div>
          <FieldLabel label="Business Address (Shown on Receipts)" />
          <TextInput value={address} onChange={(e) => setAddress(e.target.value)} disabled={!isOwner} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <FieldLabel label="Currency" />
            <SelectInput value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={!isOwner}>
              {CURRENCY_OPTIONS.map((cur) => (
                <option key={cur.code} value={cur.code}>
                  {cur.label}
                </option>
              ))}
            </SelectInput>
          </div>
          <div>
            <FieldLabel label="Interface Language" />
            <SelectInput
              value={language}
              onChange={(e) => setLanguage(e.target.value as LanguageCode)}
              disabled={!isOwner}
            >
              <option value="en">English</option>
              <option value="ta">தமிழ் (Tamil)</option>
            </SelectInput>
          </div>
          <div>
            <FieldLabel label="Date Format" />
            <SelectInput
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value as DateFormatOption)}
              disabled={!isOwner}
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </SelectInput>
          </div>
          <div>
            <FieldLabel label="Financial Year Start" />
            <SelectInput
              value={fyStart}
              onChange={(e) => setFyStart(Number(e.target.value))}
              disabled={!isOwner}
            >
              <option value={4}>April</option>
              <option value={1}>January</option>
              <option value={7}>July</option>
              <option value={10}>October</option>
            </SelectInput>
          </div>
        </div>

        {/* Tax & Receipt Settings */}
        <div className="pt-4 border-t border-[#E6EAE9] grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <label className="flex items-center gap-2.5 min-h-[44px] cursor-pointer">
            <input
              type="checkbox"
              checked={taxEnabled}
              onChange={(e) => setTaxEnabled(e.target.checked)}
              disabled={!isOwner}
              className="w-4 h-4 accent-[#147D75]"
            />
            <span className="text-sm font-medium text-[#17263C]">Enable Tax / GST on Sales</span>
          </label>

          <div>
            <FieldLabel label="Default Product Tax Rate (%)" />
            <TextInput
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={defaultTaxRate}
              onChange={(e) => setDefaultTaxRate(e.target.value)}
              disabled={!isOwner}
            />
          </div>

          <div>
            <FieldLabel label="Receipt Footer Note" />
            <TextInput
              value={receiptFooter}
              onChange={(e) => setReceiptFooter(e.target.value)}
              disabled={!isOwner}
            />
          </div>
        </div>

        {/* Alert Toggles */}
        <div className="pt-4 border-t border-[#E6EAE9] flex flex-wrap gap-6">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={lowStockAlerts}
              onChange={(e) => setLowStockAlerts(e.target.checked)}
              disabled={!isOwner}
              className="w-4 h-4 accent-[#147D75]"
            />
            <span className="text-xs font-medium text-[#17263C]">Enable Low-Stock & Expiry Alerts</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={dailyAlerts}
              onChange={(e) => setDailyAlerts(e.target.checked)}
              disabled={!isOwner}
              className="w-4 h-4 accent-[#147D75]"
            />
            <span className="text-xs font-medium text-[#17263C]">Enable Daily Summary Alerts</span>
          </label>
        </div>

        {isOwner && (
          <div className="pt-3 flex justify-end">
            <Button type="submit" variant="accent" disabled={saving}>
              <CheckCircle2 className="w-4 h-4" />
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        )}
      </form>

      {/* Team & Role Access (Owner only, Live Mode) */}
      {!isSampleMode && (
        <div className="bg-white border border-[#E6EAE9] rounded-xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E6EAE9]">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#147D75]" />
              <div>
                <h3 className="text-sm font-bold text-[#17263C]">Staff & Role Access</h3>
                <p className="text-xs text-[#758195]">
                  Managers can edit products, purchases, and expenses. Cashiers can record POS sales and customer credit
                  repayments.
                </p>
              </div>
            </div>
            {user && (
              <button
                type="button"
                onClick={copyMyUid}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E6EAE9] bg-[#F7F8F6] text-xs font-mono-num text-[#17263C] hover:bg-white cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-[#147D75]" />
                My UID: {user.uid.slice(0, 10)}...
              </button>
            )}
          </div>

          <div className="divide-y divide-[#E6EAE9] border border-[#E6EAE9] rounded-lg">
            {activeBusiness?.memberUids.map((uid) => {
              const role = uid === activeBusiness.ownerId ? "OWNER" : activeBusiness.memberRoles[uid] || "CASHIER";
              return (
                <div key={uid} className="px-4 py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="font-mono-num font-medium text-[#17263C] truncate">{uid}</p>
                    <p className="text-[#758195] mt-0.5">
                      {uid === user?.uid ? "You · " : ""}
                      {role}
                    </p>
                  </div>
                  {isOwner && uid !== activeBusiness.ownerId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={updatingTeam}
                      onClick={() => handleRemoveMember(uid)}
                    >
                      <Trash2 className="w-4 h-4 text-[#C84C4C]" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {isOwner && (
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
              <div className="sm:col-span-6">
                <TextInput
                  placeholder="Paste staff member's Firebase User UID"
                  value={newMemberUid}
                  onChange={(e) => setNewMemberUid(e.target.value)}
                />
              </div>
              <div className="sm:col-span-3">
                <SelectInput
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value as "MANAGER" | "CASHIER")}
                >
                  <option value="CASHIER">Cashier</option>
                  <option value="MANAGER">Manager</option>
                </SelectInput>
              </div>
              <div className="sm:col-span-3">
                <Button
                  type="button"
                  variant="primary"
                  className="w-full"
                  disabled={updatingTeam}
                  onClick={handleAddMember}
                >
                  <UserPlus className="w-4 h-4" />
                  Add Staff
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Offline Queue & Data Backup */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-[#E6EAE9] rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-[#17263C]">Offline Support & Sync</h3>
          <p className="text-xs text-[#758195] leading-relaxed">
            Product lookup works from a local device cache when internet drops. Eligible POS sales queue locally and sync
            automatically once online. Offline queued sales are clearly marked and excluded from cloud totals until synced.
          </p>
          <div className="p-3 rounded-lg bg-[#F7F8F6] border border-[#E6EAE9] flex items-center justify-between text-xs">
            <span>
              Status: <strong>{isOnline ? "Online" : "Offline"}</strong> · Queued sales:{" "}
              <strong className="font-mono-num">{pendingOfflineSales.length}</strong>
            </span>
            {pendingOfflineSales.length > 0 && isOnline && !isSampleMode && (
              <Button size="sm" variant="accent" onClick={syncOfflineSales}>
                <RefreshCw className="w-3.5 h-3.5" />
                Sync
              </Button>
            )}
          </div>
        </div>

        <div className="bg-white border border-[#E6EAE9] rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-[#17263C]">Data Backup & Sample Controls</h3>
          <p className="text-xs text-[#758195] leading-relaxed">
            Download a complete JSON backup of this store&apos;s products, sales, purchases, expenses, and parties anytime.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <Button variant="secondary" size="sm" onClick={handleExportSnapshotJson}>
              <Download className="w-4 h-4" />
              Export Store JSON
            </Button>
            {isSampleMode && (
              <>
                <Button variant="secondary" size="sm" onClick={resetSampleData}>
                  <Sparkles className="w-4 h-4 text-[#D99A31]" />
                  Reset Sample Store
                </Button>
                <Button variant="primary" size="sm" onClick={clearSampleMode}>
                  Exit Sample Mode
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
