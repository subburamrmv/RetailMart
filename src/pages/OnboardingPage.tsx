import React, { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useStore } from "../context/StoreContext";
import { createBusiness } from "../lib/storeService";
import {
  BUSINESS_CATEGORIES,
  CURRENCY_OPTIONS,
  type BusinessCategory,
  type LanguageCode,
} from "../types/retail";
import { RetailMateIcon } from "../components/BrandLogo";
import { Button, FieldLabel, SelectInput, TextInput } from "../components/ui/Primitives";

export function OnboardingPage({
  isAddingAnother,
  onCancel,
  onCreated,
}: {
  isAddingAnother?: boolean;
  onCancel?: () => void;
  onCreated?: () => void;
}) {
  const { user, showToast, enterSampleMode, logoutUser } = useStore();

  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState(user?.displayName || "");
  const [category, setCategory] = useState<BusinessCategory>("Grocery");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [address, setAddress] = useState("");
  const [country, setCountry] = useState("India");
  const [currency, setCurrency] = useState("INR");
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [financialYearStartMonth, setFinancialYearStartMonth] = useState(4);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleCountryChange = (val: string) => {
    setCountry(val);
    if (val.toLowerCase().includes("india")) {
      setCurrency("INR");
      setFinancialYearStartMonth(4);
    } else if (val.toLowerCase().includes("united states") || val.toLowerCase() === "usa") {
      setCurrency("USD");
      setFinancialYearStartMonth(1);
    } else if (val.toLowerCase().includes("uk") || val.toLowerCase().includes("united kingdom")) {
      setCurrency("GBP");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!name.trim() || !ownerName.trim()) {
      setError("Please enter your business name and owner name.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createBusiness({
        ownerUid: user.uid,
        name: name.trim(),
        ownerName: ownerName.trim(),
        category,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        country: country.trim() || "India",
        currency,
        language,
        dateFormat: country.toLowerCase().includes("usa") ? "MM/DD/YYYY" : "DD/MM/YYYY",
        financialYearStartMonth,
      });
      showToast(`${name.trim()} is ready!`, "success");
      if (onCreated) onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create business.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8F6] py-8 px-4 flex items-center justify-center">
      <div className="w-full max-w-2xl bg-white border border-[#E6EAE9] rounded-xl p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4 pb-5 border-b border-[#E6EAE9]">
          <div className="flex items-center gap-3">
            <RetailMateIcon size={40} surface="light" />
            <div>
              <h1 className="text-lg font-bold text-[#17263C]">
                {isAddingAnother ? "Add a New Business" : "Set up your retail business"}
              </h1>
              <p className="text-xs text-[#758195] mt-0.5">
                Fill in the essentials below. Optional details can be updated anytime in Settings.
              </p>
            </div>
          </div>

          {isAddingAnother && onCancel ? (
            <Button variant="secondary" size="sm" onClick={onCancel}>
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={enterSampleMode}>
                Try Sample
              </Button>
              <Button variant="ghost" size="sm" onClick={logoutUser}>
                Sign out
              </Button>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-[#C84C4C]/10 border border-[#C84C4C]/25 text-xs text-[#C84C4C]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel label="1. Business Name" required />
              <TextInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sri Murugan Stores"
                required
              />
            </div>
            <div>
              <FieldLabel label="2. Owner Name" required />
              <TextInput
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g. Karthik Raja"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel label="3. Business Category" required />
              <SelectInput
                value={category}
                onChange={(e) => setCategory(e.target.value as BusinessCategory)}
              >
                {BUSINESS_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </SelectInput>
            </div>
            <div>
              <FieldLabel label="4. Phone Number" hint="Optional" />
              <TextInput
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel label="5. Business Email" hint="Optional" />
              <TextInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="shop@example.com"
              />
            </div>
            <div>
              <FieldLabel label="6. Country" required />
              <TextInput
                value={country}
                onChange={(e) => handleCountryChange(e.target.value)}
                placeholder="India"
                required
              />
            </div>
          </div>

          <div>
            <FieldLabel label="7. Business Address" hint="Optional" />
            <TextInput
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, area, city, pin code"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <FieldLabel label="8. Currency" required />
              <SelectInput value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCY_OPTIONS.map((cur) => (
                  <option key={cur.code} value={cur.code}>
                    {cur.label}
                  </option>
                ))}
              </SelectInput>
            </div>
            <div>
              <FieldLabel label="9. Preferred Language" required />
              <SelectInput
                value={language}
                onChange={(e) => setLanguage(e.target.value as LanguageCode)}
              >
                <option value="en">English</option>
                <option value="ta">தமிழ் (Tamil)</option>
              </SelectInput>
            </div>
            <div>
              <FieldLabel label="10. Financial Year Start" />
              <SelectInput
                value={financialYearStartMonth}
                onChange={(e) => setFinancialYearStartMonth(Number(e.target.value))}
              >
                <option value={4}>April (India FY)</option>
                <option value={1}>January (Calendar)</option>
                <option value={7}>July</option>
                <option value={10}>October</option>
              </SelectInput>
            </div>
          </div>

          <div className="pt-4 border-t border-[#E6EAE9] flex items-center justify-end gap-3">
            {isAddingAnother && onCancel && (
              <Button type="button" variant="secondary" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" variant="accent" size="lg" disabled={saving}>
              {saving ? "Creating Store..." : "Open Business Dashboard"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
