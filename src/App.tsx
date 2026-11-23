/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { sendEmailVerification } from "firebase/auth";
import { MailCheck, RefreshCw, Sparkles } from "lucide-react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AppShell } from "./components/AppShell";
import { RetailMateLogo } from "./components/BrandLogo";
import { Button } from "./components/ui/Primitives";
import { StoreProvider, useStore, type NavTab } from "./context/StoreContext";
import { upsertUserProfile } from "./lib/storeService";
import { AuthPage } from "./pages/AuthPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { OverviewPage } from "./pages/OverviewPage";
import { ProductsPage } from "./pages/ProductsPage";
import { SalesPage } from "./pages/SalesPage";
import { PurchasesPage } from "./pages/PurchasesPage";
import { ExpensesPage } from "./pages/ExpensesPage";
import { CustomersPage } from "./pages/CustomersPage";
import { SuppliersPage } from "./pages/SuppliersPage";
import { ReportsPage } from "./pages/ReportsPage";
import { AiAssistantPage } from "./pages/AiAssistantPage";
import { SettingsPage } from "./pages/SettingsPage";

const CASHIER_ALLOWED_TABS: NavTab[] = ["overview", "products", "sales", "customers", "settings"];

function VerifyEmailGate() {
  const { user, logoutUser, enterSampleMode, showToast } = useStore();
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleResend = async () => {
    if (!user) return;
    setSending(true);
    try {
      await sendEmailVerification(user);
      showToast("Verification email sent. Check your inbox and spam folder.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not send verification email.", "error");
    } finally {
      setSending(false);
    }
  };

  const handleRefresh = async () => {
    if (!user) return;
    setChecking(true);
    try {
      await user.reload();
      if (user.emailVerified) {
        await upsertUserProfile({
          uid: user.uid,
          email: user.email || "",
          displayName: user.displayName || user.email?.split("@")[0] || "Owner",
        });
        window.location.reload();
      } else {
        showToast("Email is not verified yet. Please click the link sent to your inbox.", "warning");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to refresh status.", "error");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8F6] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-[#E6EAE9] rounded-xl p-6 sm:p-8 space-y-5">
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#E6EAE9]">
          <RetailMateLogo surface="light" size="md" showTagline />
        </div>
        <div className="w-11 h-11 rounded-lg bg-[#147D75]/10 text-[#147D75] flex items-center justify-center">
          <MailCheck className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[#17263C]">Verify your email address</h1>
          <p className="text-sm text-[#758195] mt-1.5 leading-relaxed">
            For store data security, please verify <strong>{user?.email}</strong> before creating or editing live
            records. You can also practice in the Sample Store anytime.
          </p>
        </div>

        <div className="space-y-2.5">
          <Button variant="accent" className="w-full" onClick={handleRefresh} disabled={checking}>
            <RefreshCw className="w-4 h-4" />
            {checking ? "Checking..." : "I've Verified — Continue"}
          </Button>
          <Button variant="secondary" className="w-full" onClick={handleResend} disabled={sending}>
            {sending ? "Sending..." : "Resend Verification Email"}
          </Button>
          <Button variant="secondary" className="w-full" onClick={enterSampleMode}>
            <Sparkles className="w-4 h-4 text-[#D99A31]" />
            Explore Sample Store Instead
          </Button>
        </div>

        <div className="pt-3 border-t border-[#E6EAE9] text-center">
          <button
            type="button"
            onClick={logoutUser}
            className="text-xs font-medium text-[#758195] hover:text-[#17263C] underline cursor-pointer"
          >
            Sign out and switch account
          </button>
        </div>
      </div>
    </div>
  );
}

function RetailMateRouter() {
  const {
    user,
    authReady,
    businesses,
    activeBusiness,
    userRole,
    isSampleMode,
    activeTab,
    setActiveTab,
  } = useStore();

  const [addingBusiness, setAddingBusiness] = useState(false);

  // Enforce role-based view guard so restricted tabs fall back cleanly
  useEffect(() => {
    if (userRole === "CASHIER" && !CASHIER_ALLOWED_TABS.includes(activeTab)) {
      setActiveTab("overview");
    }
  }, [userRole, activeTab, setActiveTab]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F7F8F6] flex items-center justify-center p-6">
        <div className="bg-white border border-[#E6EAE9] rounded-xl px-7 py-6 flex flex-col items-center gap-3 text-center">
          <RetailMateLogo surface="light" size="md" showTagline />
          <p className="text-xs text-[#758195]">Loading RetailMate workspace...</p>
        </div>
      </div>
    );
  }

  if (!user && !isSampleMode) {
    return <AuthPage />;
  }

  if (user && !user.emailVerified && !isSampleMode) {
    return <VerifyEmailGate />;
  }

  if (addingBusiness && !isSampleMode) {
    return (
      <OnboardingPage
        isAddingAnother
        onCancel={() => setAddingBusiness(false)}
        onCreated={() => {
          setAddingBusiness(false);
          setActiveTab("overview");
        }}
      />
    );
  }

  if (!isSampleMode && businesses.length === 0) {
    return <OnboardingPage onCreated={() => setActiveTab("overview")} />;
  }

  if (!activeBusiness) {
    return (
      <div className="min-h-screen bg-[#F7F8F6] flex items-center justify-center p-6">
        <div className="bg-white border border-[#E6EAE9] rounded-xl px-7 py-6 flex flex-col items-center gap-3 text-center">
          <RetailMateLogo surface="light" size="md" showTagline />
          <p className="text-xs text-[#758195]">Opening store workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <AppShell onOpenNewBusiness={() => setAddingBusiness(true)}>
      {activeTab === "overview" && <OverviewPage />}
      {activeTab === "products" && <ProductsPage />}
      {activeTab === "sales" && <SalesPage />}
      {activeTab === "purchases" && <PurchasesPage />}
      {activeTab === "expenses" && <ExpensesPage />}
      {activeTab === "customers" && <CustomersPage />}
      {activeTab === "suppliers" && <SuppliersPage />}
      {activeTab === "reports" && <ReportsPage />}
      {activeTab === "ai" && <AiAssistantPage />}
      {activeTab === "settings" && <SettingsPage onOpenNewBusiness={() => setAddingBusiness(true)} />}
    </AppShell>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <RetailMateRouter />
      </StoreProvider>
    </ErrorBoundary>
  );
}
