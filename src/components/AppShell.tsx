import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  Bell,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  CreditCard,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  RefreshCw,
  Settings,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useStore, type NavTab } from "../context/StoreContext";
import { calculateFinancialSummary, formatCurrency, resolveDateRange } from "../lib/finance";
import { t } from "../lib/i18n";
import { RetailMateIcon, RetailMateLogo } from "./BrandLogo";
import { Button } from "./ui/Primitives";

export function AppShell({
  onOpenNewBusiness,
  children,
}: {
  onOpenNewBusiness: () => void;
  children: React.ReactNode;
}) {
  const {
    user,
    activeBusiness,
    businesses,
    userRole,
    isSampleMode,
    isOnline,
    pendingOfflineSales,
    syncOfflineSales,
    activeTab,
    setActiveTab,
    switchBusiness,
    logoutUser,
    clearSampleMode,
    resetSampleData,
    products,
    variants,
    sales,
    saleItems,
    purchases,
    expenses,
    payments,
    toasts,
    dismissToast,
  } = useStore();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [bizMenuOpen, setBizMenuOpen] = useState(false);

  const lang = activeBusiness?.language || "en";

  const navItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ReactNode;
    roles: Array<"OWNER" | "MANAGER" | "CASHIER">;
  }> = [
    { id: "overview", label: t(lang, "navOverview"), icon: <LayoutDashboard className="w-4 h-4" />, roles: ["OWNER", "MANAGER", "CASHIER"] },
    { id: "products", label: t(lang, "navProducts"), icon: <Package className="w-4 h-4" />, roles: ["OWNER", "MANAGER", "CASHIER"] },
    { id: "sales", label: t(lang, "navSales"), icon: <ShoppingBag className="w-4 h-4" />, roles: ["OWNER", "MANAGER", "CASHIER"] },
    { id: "purchases", label: t(lang, "navPurchases"), icon: <Truck className="w-4 h-4" />, roles: ["OWNER", "MANAGER"] },
    { id: "expenses", label: t(lang, "navExpenses"), icon: <Wallet className="w-4 h-4" />, roles: ["OWNER", "MANAGER"] },
    { id: "customers", label: t(lang, "navCustomers"), icon: <Users className="w-4 h-4" />, roles: ["OWNER", "MANAGER", "CASHIER"] },
    { id: "suppliers", label: t(lang, "navSuppliers"), icon: <Store className="w-4 h-4" />, roles: ["OWNER", "MANAGER"] },
    { id: "reports", label: t(lang, "navReports"), icon: <BarChart3 className="w-4 h-4" />, roles: ["OWNER", "MANAGER"] },
    { id: "ai", label: t(lang, "navAiAssistant"), icon: <Bot className="w-4 h-4" />, roles: ["OWNER", "MANAGER"] },
    { id: "settings", label: t(lang, "navSettings"), icon: <Settings className="w-4 h-4" />, roles: ["OWNER", "MANAGER", "CASHIER"] },
  ];

  const allowedNav = navItems.filter((item) => item.roles.includes(userRole));

  // Smart business alerts computed from real data
  const alerts = useMemo(() => {
    if (!activeBusiness) return [];
    const { startDate, endDate } = resolveDateRange("today");
    const summary = calculateFinancialSummary({
      sales,
      saleItems,
      purchases,
      expenses,
      products,
      variants,
      payments,
      startDate,
      endDate,
    });
    const list: Array<{ id: string; title: string; detail: string; severity: "error" | "warning" | "info"; targetTab: NavTab }> = [];
    if (activeBusiness.lowStockAlertsEnabled !== false) {
      if (summary.outOfStockCount > 0) {
        list.push({
          id: "out-of-stock",
          title: `${summary.outOfStockCount} product(s) out of stock`,
          detail: "Customers cannot buy these until restocked.",
          severity: "error",
          targetTab: "products",
        });
      }
      const lowOnly = summary.lowStockProducts.filter((p) => p.status === "LOW_STOCK");
      if (lowOnly.length > 0) {
        list.push({
          id: "low-stock",
          title: `${lowOnly.length} product(s) running low`,
          detail: lowOnly.slice(0, 3).map((p) => p.name).join(", "),
          severity: "warning",
          targetTab: "products",
        });
      }
      if (summary.expiringSoonProducts.length > 0) {
        list.push({
          id: "expiring",
          title: `${summary.expiringSoonProducts.length} product(s) expiring within 30 days`,
          detail: `${summary.expiringSoonProducts[0].name} (${summary.expiringSoonProducts[0].daysRemaining}d left)`,
          severity: "warning",
          targetTab: "products",
        });
      }
    }
    if (summary.pendingSupplierPayables > 0) {
      list.push({
        id: "payables",
        title: "Pending supplier payments",
        detail: `${formatCurrency(summary.pendingSupplierPayables, activeBusiness.currency)} due across open bills.`,
        severity: "info",
        targetTab: "purchases",
      });
    }
    if (summary.pendingCustomerReceivables > 0) {
      list.push({
        id: "receivables",
        title: "Pending customer credit balances",
        detail: `${formatCurrency(summary.pendingCustomerReceivables, activeBusiness.currency)} owed by credit customers.`,
        severity: "info",
        targetTab: "customers",
      });
    }
    return list;
  }, [activeBusiness, sales, saleItems, purchases, expenses, products, variants, payments]);

  const activeNavItem = navItems.find((n) => n.id === activeTab);

  return (
    <div className="min-h-screen bg-[#F7F8F6] text-[#17263C] flex">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 bg-white border-r border-[#E6EAE9] transition-all duration-150 no-print ${
          sidebarCollapsed ? "w-[72px]" : "w-[248px]"
        }`}
      >
        <div className="h-16 px-4 flex items-center justify-between border-b border-[#E6EAE9]">
          {!sidebarCollapsed ? (
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className="flex items-center text-left cursor-pointer min-w-0"
            >
              <RetailMateLogo surface="light" size="md" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              aria-label="RetailMate Overview"
              className="mx-auto flex items-center justify-center cursor-pointer"
            >
              <RetailMateIcon size={34} surface="light" />
            </button>
          )}
          {!sidebarCollapsed && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              aria-label="Collapse sidebar"
              className="p-1.5 rounded-md text-[#758195] hover:bg-[#F7F8F6] hover:text-[#17263C] cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {sidebarCollapsed && (
          <button
            type="button"
            onClick={() => setSidebarCollapsed(false)}
            aria-label="Expand sidebar"
            className="mx-auto mt-3 p-1.5 rounded-md text-[#758195] hover:bg-[#F7F8F6] hover:text-[#17263C] cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {allowedNav.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? "bg-[#17263C] text-white"
                    : "text-[#758195] hover:bg-[#F7F8F6] hover:text-[#17263C]"
                } ${sidebarCollapsed ? "justify-center px-2" : ""}`}
              >
                <span className="shrink-0">{item.icon}</span>
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[#E6EAE9] space-y-1.5">
          {!sidebarCollapsed && (
            <div className="px-2.5 py-2 rounded-lg bg-[#F7F8F6] text-xs">
              <p className="font-medium text-[#17263C] truncate">{activeBusiness?.name}</p>
              <p className="text-[#758195] truncate mt-0.5">
                {userRole} · {activeBusiness?.currency || "INR"}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={isSampleMode ? clearSampleMode : logoutUser}
            title={isSampleMode ? "Exit Sample Mode" : "Sign out"}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-[#758195] hover:bg-[#F7F8F6] hover:text-[#C84C4C] transition-colors cursor-pointer ${
              sidebarCollapsed ? "justify-center px-2" : ""
            }`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>{isSampleMode ? "Exit Sample Mode" : "Sign out"}</span>}
          </button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Sample Mode / Offline Notice Bar */}
        {isSampleMode && (
          <div className="bg-[#17263C] text-white px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 no-print">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#D99A31] shrink-0" />
              <span>{t(lang, "sampleBadge")}</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={resetSampleData}
                className="underline hover:text-[#E6EAE9] cursor-pointer whitespace-nowrap"
              >
                Reset Sample
              </button>
              <button
                type="button"
                onClick={clearSampleMode}
                className="px-2.5 py-1 rounded bg-white text-[#17263C] font-medium hover:bg-[#F7F8F6] cursor-pointer whitespace-nowrap"
              >
                {user ? "Return to My Business" : "Sign In for Real Store"}
              </button>
            </div>
          </div>
        )}

        {!isOnline && (
          <div className="bg-[#D99A31]/15 border-b border-[#D99A31]/30 text-[#17263C] px-4 py-2 text-xs flex items-center justify-between gap-2 no-print">
            <div className="flex items-center gap-2">
              <CloudOff className="w-4 h-4 text-[#D99A31] shrink-0" />
              <span>{t(lang, "offlineLabel")}</span>
            </div>
            {pendingOfflineSales.length > 0 && (
              <span className="font-mono-num font-medium">{pendingOfflineSales.length} queued</span>
            )}
          </div>
        )}

        {isOnline && pendingOfflineSales.length > 0 && !isSampleMode && (
          <div className="bg-[#147D75]/10 border-b border-[#147D75]/20 text-[#17263C] px-4 py-2 text-xs flex items-center justify-between gap-2 no-print">
            <span>
              {pendingOfflineSales.length} offline sale(s) pending synchronisation. Not counted in cloud totals until synced.
            </span>
            <Button size="sm" variant="accent" onClick={syncOfflineSales}>
              <RefreshCw className="w-3.5 h-3.5" />
              Sync Now
            </Button>
          </div>
        )}

        {/* Top Bar (3-zone contract) */}
        <header className="sticky top-0 z-30 h-14 lg:h-16 bg-white border-b border-[#E6EAE9] px-4 lg:px-6 flex items-center justify-between gap-4 no-print">
          {/* Left: Current section & Mobile wordmark */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="lg:hidden shrink-0">
              <RetailMateIcon size={30} surface="light" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm lg:text-base font-semibold text-[#17263C] truncate">
                {activeNavItem?.label || "RetailMate"}
              </h1>
              <p className="text-[11px] text-[#758195] truncate lg:hidden">
                {activeBusiness?.name}
              </p>
            </div>
          </div>

          {/* Center/Right: Business Switcher, Alerts & Quick Sale CTA */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {!isSampleMode && businesses.length > 0 && (
              <div className="relative hidden sm:block">
                <button
                  type="button"
                  onClick={() => setBizMenuOpen((v) => !v)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 min-h-[38px] rounded-lg border border-[#E6EAE9] bg-[#F7F8F6] text-xs font-medium text-[#17263C] hover:bg-[#E6EAE9]/60 cursor-pointer max-w-[200px]"
                >
                  <Store className="w-3.5 h-3.5 text-[#147D75] shrink-0" />
                  <span className="truncate">{activeBusiness?.name}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-[#758195] shrink-0" />
                </button>
                {bizMenuOpen && (
                  <div className="absolute right-0 mt-1.5 w-64 bg-white border border-[#E6EAE9] rounded-xl shadow-lg py-1.5 z-40">
                    <div className="px-3 py-1.5 text-[11px] font-medium text-[#758195]">
                      Switch Business
                    </div>
                    {businesses.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          switchBusiness(b.id);
                          setBizMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-[#F7F8F6] cursor-pointer ${
                          b.id === activeBusiness?.id ? "font-semibold text-[#147D75]" : "text-[#17263C]"
                        }`}
                      >
                        <span className="truncate">{b.name}</span>
                        <span className="text-[11px] text-[#758195]">{b.currency}</span>
                      </button>
                    ))}
                    <div className="border-t border-[#E6EAE9] mt-1 pt-1 px-2">
                      <button
                        type="button"
                        onClick={() => {
                          setBizMenuOpen(false);
                          onOpenNewBusiness();
                        }}
                        className="w-full flex items-center gap-2 px-2 py-2 text-xs font-medium text-[#147D75] hover:bg-[#F7F8F6] rounded-lg cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add another business
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Alerts Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setAlertsOpen((v) => !v)}
                aria-label="Business alerts"
                className="relative min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg border border-[#E6EAE9] bg-white text-[#17263C] hover:bg-[#F7F8F6] cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {alerts.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#C84C4C] text-white text-[10px] font-mono-num flex items-center justify-center">
                    {alerts.length}
                  </span>
                )}
              </button>
              {alertsOpen && (
                <div className="absolute right-0 mt-1.5 w-80 max-w-[calc(100vw-2rem)] bg-white border border-[#E6EAE9] rounded-xl shadow-lg z-40 overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#E6EAE9] flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#17263C]">Smart Business Alerts</span>
                    <button
                      type="button"
                      onClick={() => setAlertsOpen(false)}
                      className="text-[#758195] hover:text-[#17263C] cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-[#E6EAE9]">
                    {alerts.length === 0 ? (
                      <div className="p-5 text-center text-xs text-[#758195]">
                        Everything looks steady. No urgent stock or payment alerts right now.
                      </div>
                    ) : (
                      alerts.map((al) => (
                        <button
                          key={al.id}
                          type="button"
                          onClick={() => {
                            setActiveTab(al.targetTab);
                            setAlertsOpen(false);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-[#F7F8F6] transition-colors cursor-pointer"
                        >
                          <p
                            className={`text-xs font-semibold ${
                              al.severity === "error"
                                ? "text-[#C84C4C]"
                                : al.severity === "warning"
                                ? "text-[#D99A31]"
                                : "text-[#147D75]"
                            }`}
                          >
                            {al.title}
                          </p>
                          <p className="text-xs text-[#758195] mt-0.5">{al.detail}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <Button
              variant="accent"
              size="sm"
              onClick={() => setActiveTab("sales")}
              className="hidden sm:inline-flex"
            >
              <Plus className="w-4 h-4" />
              {t(lang, "newSale")}
            </Button>
          </div>
        </header>

        {/* Scrollable Content Viewport */}
        <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-8 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation (5 shortcuts: Home, Inventory, New Sale, Reports, More) */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E6EAE9] pb-safe no-print"
      >
        <div className="grid grid-cols-5 h-16 items-center">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`flex flex-col items-center justify-center h-full cursor-pointer ${
              activeTab === "overview" ? "text-[#147D75]" : "text-[#758195]"
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-medium mt-1">{t(lang, "mobileHome")}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("products")}
            className={`flex flex-col items-center justify-center h-full cursor-pointer ${
              activeTab === "products" ? "text-[#147D75]" : "text-[#758195]"
            }`}
          >
            <Package className="w-5 h-5" />
            <span className="text-[10px] font-medium mt-1">{t(lang, "mobileInventory")}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("sales")}
            className="flex flex-col items-center justify-center h-full cursor-pointer"
          >
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                activeTab === "sales" ? "bg-[#17263C] text-white" : "bg-[#147D75] text-white"
              }`}
            >
              <CreditCard className="w-5 h-5" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab(userRole === "CASHIER" ? "customers" : "reports")}
            className={`flex flex-col items-center justify-center h-full cursor-pointer ${
              activeTab === "reports" ? "text-[#147D75]" : "text-[#758195]"
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="text-[10px] font-medium mt-1">
              {userRole === "CASHIER" ? "Customers" : t(lang, "mobileReports")}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center justify-center h-full cursor-pointer ${
              moreOpen ? "text-[#147D75]" : "text-[#758195]"
            }`}
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] font-medium mt-1">{t(lang, "mobileMore")}</span>
          </button>
        </div>
      </nav>

      {/* Mobile More Drawer */}
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-[#17263C]/40 flex items-end">
          <div className="w-full bg-white rounded-t-2xl border-t border-[#E6EAE9] p-5 max-h-[82vh] overflow-y-auto pb-safe">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6EAE9] mb-3">
              <div>
                <p className="text-sm font-semibold text-[#17263C]">{activeBusiness?.name}</p>
                <p className="text-xs text-[#758195]">
                  {userRole} · {activeBusiness?.currency}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[#758195]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {allowedNav.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMoreOpen(false);
                  }}
                  className={`flex items-center gap-2.5 px-3.5 py-3 min-h-[48px] rounded-xl border text-left text-sm font-medium ${
                    activeTab === item.id
                      ? "bg-[#17263C] text-white border-[#17263C]"
                      : "bg-[#F7F8F6] text-[#17263C] border-[#E6EAE9]"
                  }`}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </div>

            {!isSampleMode && businesses.length > 0 && (
              <div className="mt-4 pt-3 border-t border-[#E6EAE9] space-y-2">
                <p className="text-xs font-medium text-[#758195]">Businesses</p>
                <div className="flex flex-wrap gap-2">
                  {businesses.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        switchBusiness(b.id);
                        setMoreOpen(false);
                      }}
                      className={`px-3 py-2 rounded-lg border text-xs font-medium ${
                        b.id === activeBusiness?.id
                          ? "border-[#147D75] text-[#147D75] bg-[#147D75]/5"
                          : "border-[#E6EAE9] text-[#17263C]"
                      }`}
                    >
                      {b.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setMoreOpen(false);
                      onOpenNewBusiness();
                    }}
                    className="px-3 py-2 rounded-lg border border-dashed border-[#147D75] text-xs font-medium text-[#147D75]"
                  >
                    + New Business
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-[#E6EAE9]">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  setMoreOpen(false);
                  if (isSampleMode) clearSampleMode();
                  else logoutUser();
                }}
              >
                <LogOut className="w-4 h-4" />
                {isSampleMode ? "Exit Sample Mode" : "Sign out"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Stack */}
      <div className="fixed bottom-20 lg:bottom-6 right-4 z-50 space-y-2 max-w-sm w-[calc(100vw-2rem)] pointer-events-none no-print">
        {toasts.map((tst) => (
          <div
            key={tst.id}
            className="pointer-events-auto bg-[#17263C] text-white px-4 py-3 rounded-xl shadow-lg flex items-start gap-2.5 text-xs"
          >
            {tst.tone === "success" && <CheckCircle2 className="w-4 h-4 text-[#21865B] shrink-0 mt-0.5" />}
            {tst.tone === "warning" && <AlertCircle className="w-4 h-4 text-[#D99A31] shrink-0 mt-0.5" />}
            {tst.tone === "error" && <AlertCircle className="w-4 h-4 text-[#C84C4C] shrink-0 mt-0.5" />}
            <span className="flex-1 leading-relaxed">{tst.text}</span>
            <button
              type="button"
              onClick={() => dismissToast(tst.id)}
              className="text-white/70 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
