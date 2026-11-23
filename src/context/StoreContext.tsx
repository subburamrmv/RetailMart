import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "../lib/firebase";
import { cacheProductsLocally, getPendingOfflineSales, removeOfflineSale, updateOfflineSaleError } from "../lib/offlineQueue";
import { createSampleStoreBundle, type StoreDataset } from "../lib/sampleData";
import { completeSale, makeId, updateActiveBusiness, upsertUserProfile } from "../lib/storeService";
import { roundMoney, roundQty, toLocalDateKey } from "../lib/finance";
import type {
  AuditLog,
  Business,
  BusinessRole,
  CartLineItem,
  Customer,
  Expense,
  InventoryMovement,
  NotificationRecord,
  Payment,
  PaymentBreakdown,
  PaymentMethod,
  PendingOfflineSale,
  Product,
  ProductVariant,
  Purchase,
  PurchaseItem,
  Sale,
  SaleItem,
  SimplePaymentMethod,
  Supplier,
  UserProfile,
} from "../types/retail";

export type NavTab =
  | "overview"
  | "products"
  | "sales"
  | "purchases"
  | "expenses"
  | "customers"
  | "suppliers"
  | "reports"
  | "ai"
  | "settings";

export interface ToastMessage {
  id: string;
  text: string;
  tone: "success" | "warning" | "error";
}

interface StoreContextValue {
  user: User | null;
  authReady: boolean;
  userProfile: UserProfile | null;
  businesses: Business[];
  activeBusiness: Business | null;
  userRole: BusinessRole;
  isSampleMode: boolean;
  isOnline: boolean;
  dataLoading: boolean;
  products: Product[];
  variants: ProductVariant[];
  movements: InventoryMovement[];
  sales: Sale[];
  saleItems: SaleItem[];
  purchases: Purchase[];
  purchaseItems: PurchaseItem[];
  expenses: Expense[];
  customers: Customer[];
  suppliers: Supplier[];
  payments: Payment[];
  notifications: NotificationRecord[];
  auditLogs: AuditLog[];
  pendingOfflineSales: PendingOfflineSale[];
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  enterSampleMode: () => void;
  clearSampleMode: () => void;
  resetSampleData: () => void;
  updateSampleBundle: (updater: (prev: StoreDataset) => StoreDataset) => void;
  switchBusiness: (businessId: string) => Promise<void>;
  logoutUser: () => Promise<void>;
  syncOfflineSales: () => Promise<void>;
  refreshOfflineQueue: () => void;
  toasts: ToastMessage[];
  showToast: (text: string, tone?: "success" | "warning" | "error") => void;
  dismissToast: (id: string) => void;
  // Sample mode interactive helpers
  sampleCompleteSale: (params: {
    items: CartLineItem[];
    discountAmount: number;
    paymentMethod: PaymentMethod;
    paymentBreakdown: PaymentBreakdown;
    customerId?: string;
    customerName?: string;
    notes?: string;
  }) => Sale;
  sampleAdjustStock: (params: {
    productId: string;
    variantId?: string;
    movementType: "ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "DAMAGED_OUT" | "EXPIRED_OUT" | "RECONCILIATION";
    quantityOrCountedStock: number;
    reason: string;
  }) => void;
  sampleReceivePurchase: (purchaseId: string) => void;
  sampleRecordPayment: (partyType: "CUSTOMER" | "SUPPLIER", partyId: string, amount: number, method: SimplePaymentMethod, purchaseId?: string) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

const SAMPLE_STORAGE_KEY = "retailmate_sample_sandbox_v1";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("");
  const [dataLoading, setDataLoading] = useState(false);

  const [isSampleMode, setIsSampleMode] = useState(false);
  const [sampleBundle, setSampleBundle] = useState<StoreDataset>(() => {
    try {
      const saved = localStorage.getItem(SAMPLE_STORAGE_KEY);
      if (saved) return JSON.parse(saved) as StoreDataset;
    } catch {
      // ignore
    }
    return createSampleStoreBundle();
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pendingOfflineSales, setPendingOfflineSales] = useState<PendingOfflineSale[]>([]);
  const [activeTab, setActiveTab] = useState<NavTab>("overview");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((text: string, tone: "success" | "warning" | "error" = "success") => {
    const id = makeId("tst");
    setToasts((prev) => [...prev.slice(-3), { id, text, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (firebaseUser) {
        setIsSampleMode(false);
        if (firebaseUser.emailVerified) {
          try {
            await upsertUserProfile({
              uid: firebaseUser.uid,
              email: firebaseUser.email || "",
              displayName: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Owner",
            });
          } catch (err) {
            console.error("Failed to sync user profile:", err);
          }
        }
      } else {
        setUserProfile(null);
        setBusinesses([]);
        setSelectedBusinessId("");
      }
    });
    return () => unsub();
  }, []);

  // User profile & Businesses listeners
  useEffect(() => {
    if (!user || isSampleMode) return;

    const unsubUser = onSnapshot(
      doc(db, "users", user.uid),
      (snap) => {
        if (snap.exists()) {
          const prof = snap.data() as UserProfile;
          setUserProfile(prof);
          if (prof.activeBusinessId) {
            setSelectedBusinessId((prev) => prev || prof.activeBusinessId || "");
          }
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}`)
    );

    const bizQuery = query(
      collection(db, "businesses"),
      where("memberUids", "array-contains", user.uid)
    );
    const unsubBiz = onSnapshot(
      bizQuery,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Business);
        setBusinesses(list);
        setSelectedBusinessId((prev) => {
          if (prev && list.some((b) => b.id === prev)) return prev;
          return list[0]?.id || "";
        });
      },
      (err) => handleFirestoreError(err, OperationType.LIST, "businesses")
    );

    return () => {
      unsubUser();
      unsubBiz();
    };
  }, [user, isSampleMode]);

  const activeBusiness = useMemo(() => {
    if (isSampleMode) return sampleBundle.business;
    return businesses.find((b) => b.id === selectedBusinessId) || businesses[0] || null;
  }, [isSampleMode, sampleBundle.business, businesses, selectedBusinessId]);

  const userRole: BusinessRole = useMemo(() => {
    if (isSampleMode) return "OWNER";
    if (!activeBusiness || !user) return "CASHIER";
    if (activeBusiness.ownerId === user.uid) return "OWNER";
    return activeBusiness.memberRoles[user.uid] || "CASHIER";
  }, [isSampleMode, activeBusiness, user]);

  // Subcollection listeners for active live business
  useEffect(() => {
    if (isSampleMode || !user || !activeBusiness) {
      if (!isSampleMode) {
        setProducts([]);
        setVariants([]);
        setMovements([]);
        setSales([]);
        setSaleItems([]);
        setPurchases([]);
        setPurchaseItems([]);
        setExpenses([]);
        setCustomers([]);
        setSuppliers([]);
        setPayments([]);
        setNotifications([]);
        setAuditLogs([]);
      }
      return;
    }

    const bizId = activeBusiness.id;
    setDataLoading(true);
    setPendingOfflineSales(getPendingOfflineSales(bizId));

    const makeSub = <T,>(
      subName: string,
      setter: React.Dispatch<React.SetStateAction<T[]>>,
      onData?: (rows: T[]) => void
    ) => {
      const q = query(
        collection(db, "businesses", bizId, subName),
        where("memberUids", "array-contains", user.uid)
      );
      return onSnapshot(
        q,
        (snap) => {
          const rows = snap.docs.map((d) => d.data() as T);
          setter(rows);
          if (onData) onData(rows);
          setDataLoading(false);
        },
        (err) => {
          setDataLoading(false);
          handleFirestoreError(err, OperationType.LIST, `businesses/${bizId}/${subName}`);
        }
      );
    };

    const unsubs = [
      makeSub<Product>("products", setProducts, (rows) => cacheProductsLocally(bizId, rows)),
      makeSub<ProductVariant>("product_variants", setVariants),
      makeSub<InventoryMovement>("inventory_movements", setMovements),
      makeSub<Sale>("sales", setSales),
      makeSub<SaleItem>("sale_items", setSaleItems),
      makeSub<Purchase>("purchases", setPurchases),
      makeSub<PurchaseItem>("purchase_items", setPurchaseItems),
      makeSub<Expense>("expenses", setExpenses),
      makeSub<Customer>("customers", setCustomers),
      makeSub<Supplier>("suppliers", setSuppliers),
      makeSub<Payment>("payments", setPayments),
      makeSub<NotificationRecord>("notifications", setNotifications),
      makeSub<AuditLog>("audit_logs", setAuditLogs),
    ];

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [isSampleMode, user, activeBusiness?.id]);

  const refreshOfflineQueue = useCallback(() => {
    if (activeBusiness && !isSampleMode) {
      setPendingOfflineSales(getPendingOfflineSales(activeBusiness.id));
    }
  }, [activeBusiness, isSampleMode]);

  const syncOfflineSales = useCallback(async () => {
    if (isSampleMode || !user || !activeBusiness || !navigator.onLine) return;
    const queue = getPendingOfflineSales(activeBusiness.id);
    if (queue.length === 0) return;

    let synced = 0;
    for (const queued of queue) {
      try {
        await completeSale({
          business: activeBusiness,
          actorUid: user.uid,
          actorName: userProfile?.displayName || user.displayName || "Owner",
          idempotencyKey: queued.idempotencyKey,
          transactionDate: queued.transactionDate,
          items: queued.items,
          discountAmount: queued.discountAmount,
          paymentMethod: queued.paymentMethod,
          paymentBreakdown: queued.paymentBreakdown,
          customerId: queued.customerId,
          customerName: queued.customerName,
          notes: queued.notes,
        });
        removeOfflineSale(activeBusiness.id, queued.idempotencyKey);
        synced++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Sync failed";
        updateOfflineSaleError(activeBusiness.id, queued.idempotencyKey, msg);
      }
    }
    setPendingOfflineSales(getPendingOfflineSales(activeBusiness.id));
    if (synced > 0) {
      showToast(`Synchronised ${synced} offline sale(s) to the cloud.`, "success");
    }
  }, [isSampleMode, user, activeBusiness, userProfile, showToast]);

  useEffect(() => {
    if (isOnline && !isSampleMode && activeBusiness && pendingOfflineSales.length > 0) {
      syncOfflineSales();
    }
  }, [isOnline, isSampleMode, activeBusiness?.id]);

  const enterSampleMode = useCallback(() => {
    setIsSampleMode(true);
    setActiveTab("overview");
  }, []);

  const clearSampleMode = useCallback(() => {
    localStorage.removeItem(SAMPLE_STORAGE_KEY);
    setSampleBundle(createSampleStoreBundle());
    setIsSampleMode(false);
  }, []);

  const resetSampleData = useCallback(() => {
    const fresh = createSampleStoreBundle();
    setSampleBundle(fresh);
    try {
      localStorage.setItem(SAMPLE_STORAGE_KEY, JSON.stringify(fresh));
    } catch {
      // ignore
    }
    showToast("Sample store data reset to clean defaults.", "success");
  }, [showToast]);

  const updateSampleBundle = useCallback((updater: (prev: StoreDataset) => StoreDataset) => {
    setSampleBundle((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem(SAMPLE_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const switchBusiness = useCallback(
    async (businessId: string) => {
      setSelectedBusinessId(businessId);
      if (user) {
        await updateActiveBusiness(user.uid, businessId);
      }
    },
    [user]
  );

  const logoutUser = useCallback(async () => {
    setIsSampleMode(false);
    await signOut(auth);
  }, []);

  // Sample mode interactive helpers
  const sampleCompleteSale = useCallback(
    (params: {
      items: CartLineItem[];
      discountAmount: number;
      paymentMethod: PaymentMethod;
      paymentBreakdown: PaymentBreakdown;
      customerId?: string;
      customerName?: string;
      notes?: string;
    }) => {
      const saleId = makeId("sal");
      const receiptNumber = `RM-${saleId.slice(-6).toUpperCase()}`;
      const txDate = new Date().toISOString();
      const biz = sampleBundle.business;

      let subtotal = 0;
      let taxAmount = 0;
      let totalCost = 0;
      const newItems: SaleItem[] = [];
      const newMovs: InventoryMovement[] = [];

      const nextProducts = [...sampleBundle.products];
      const nextVariants = [...sampleBundle.variants];

      for (const line of params.items) {
        if (line.variantId) {
          const vIdx = nextVariants.findIndex((v) => v.id === line.variantId);
          if (vIdx === -1 || nextVariants[vIdx].currentStock < line.quantity) {
            throw new Error(`Insufficient stock for ${line.productName}`);
          }
          const prev = nextVariants[vIdx].currentStock;
          const next = roundQty(prev - line.quantity);
          nextVariants[vIdx] = { ...nextVariants[vIdx], currentStock: next };
          newMovs.push({
            id: makeId("mov"),
            businessId: biz.id,
            ownerId: biz.ownerId,
            memberUids: biz.memberUids,
            productId: line.productId,
            variantId: line.variantId,
            productName: line.productName,
            movementType: "SALE_OUT",
            quantityDelta: -line.quantity,
            previousStock: prev,
            newStock: next,
            unitCost: nextVariants[vIdx].purchaseCost,
            reason: `Sold on receipt ${receiptNumber}`,
            referenceType: "SALE",
            referenceId: saleId,
            performedBy: biz.ownerId,
            transactionDate: txDate,
          });
        } else {
          const pIdx = nextProducts.findIndex((p) => p.id === line.productId);
          if (pIdx === -1 || nextProducts[pIdx].currentStock < line.quantity) {
            throw new Error(`Insufficient stock for ${line.productName}`);
          }
          const prev = nextProducts[pIdx].currentStock;
          const next = roundQty(prev - line.quantity);
          nextProducts[pIdx] = { ...nextProducts[pIdx], currentStock: next };
          newMovs.push({
            id: makeId("mov"),
            businessId: biz.id,
            ownerId: biz.ownerId,
            memberUids: biz.memberUids,
            productId: line.productId,
            productName: line.productName,
            movementType: "SALE_OUT",
            quantityDelta: -line.quantity,
            previousStock: prev,
            newStock: next,
            unitCost: nextProducts[pIdx].purchaseCost,
            reason: `Sold on receipt ${receiptNumber}`,
            referenceType: "SALE",
            referenceId: saleId,
            performedBy: biz.ownerId,
            transactionDate: txDate,
          });
        }

        const lineGross = roundMoney(line.unitPrice * line.quantity);
        const effTax = biz.taxEnabled ? line.taxRate : 0;
        const lineTax = roundMoney((lineGross * effTax) / 100);
        const lineTotal = roundMoney(lineGross + lineTax);
        subtotal = roundMoney(subtotal + lineGross);
        taxAmount = roundMoney(taxAmount + lineTax);
        totalCost = roundMoney(totalCost + line.unitCostSnapshot * line.quantity);

        newItems.push({
          id: makeId("sit"),
          businessId: biz.id,
          ownerId: biz.ownerId,
          memberUids: biz.memberUids,
          saleId,
          productId: line.productId,
          variantId: line.variantId,
          productName: line.productName,
          unit: line.unit,
          quantity: line.quantity,
          returnedQuantity: 0,
          unitPrice: line.unitPrice,
          unitCostSnapshot: line.unitCostSnapshot,
          discountAmount: 0,
          taxRate: effTax,
          taxAmount: lineTax,
          lineTotal,
          transactionDate: txDate,
        });
      }

      const safeDisc = Math.min(subtotal, Math.max(0, roundMoney(params.discountAmount)));
      const totalAmount = Math.max(0, roundMoney(subtotal - safeDisc + taxAmount));
      const paidAmount = roundMoney(
        (params.paymentBreakdown.cash || 0) +
          (params.paymentBreakdown.upi || 0) +
          (params.paymentBreakdown.card || 0) +
          (params.paymentBreakdown.bankTransfer || 0)
      );

      const newSale: Sale = {
        id: saleId,
        businessId: biz.id,
        ownerId: biz.ownerId,
        memberUids: biz.memberUids,
        receiptNumber,
        transactionDate: txDate,
        subtotal,
        discountAmount: safeDisc,
        taxAmount,
        totalAmount,
        totalCost,
        paidAmount,
        creditAmount: roundMoney(params.paymentBreakdown.credit || 0),
        refundedAmount: 0,
        paymentMethod: params.paymentMethod,
        paymentBreakdown: params.paymentBreakdown,
        customerId: params.customerId,
        customerName: params.customerName,
        staffUid: biz.ownerId,
        staffName: biz.ownerName,
        status: "COMPLETED",
        itemCount: newItems.length,
        notes: params.notes,
      };

      updateSampleBundle((prev) => ({
        ...prev,
        products: nextProducts,
        variants: nextVariants,
        sales: [newSale, ...prev.sales],
        saleItems: [...newItems, ...prev.saleItems],
        movements: [...newMovs, ...prev.movements],
        customers: params.customerId
          ? prev.customers.map((c) =>
              c.id === params.customerId
                ? {
                    ...c,
                    totalPurchases: roundMoney(c.totalPurchases + totalAmount),
                    outstandingCredit: roundMoney(c.outstandingCredit + newSale.creditAmount),
                  }
                : c
            )
          : prev.customers,
        auditLogs: [
          {
            id: makeId("log"),
            businessId: biz.id,
            ownerId: biz.ownerId,
            memberUids: biz.memberUids,
            action: "SALE_COMPLETED",
            entityType: "SALE",
            entityId: saleId,
            summary: `Receipt ${receiptNumber}: ${newItems.length} item(s), total ${totalAmount}`,
            actorUid: biz.ownerId,
            actorName: biz.ownerName,
          },
          ...prev.auditLogs,
        ],
      }));

      return newSale;
    },
    [sampleBundle, updateSampleBundle]
  );

  const sampleAdjustStock = useCallback(
    (params: {
      productId: string;
      variantId?: string;
      movementType: "ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "DAMAGED_OUT" | "EXPIRED_OUT" | "RECONCILIATION";
      quantityOrCountedStock: number;
      reason: string;
    }) => {
      updateSampleBundle((prev) => {
        const biz = prev.business;
        let mov: InventoryMovement | null = null;
        const nextProducts = prev.products.map((p) => {
          if (p.id !== params.productId || params.variantId) return p;
          const prevQty = p.currentStock;
          const nextQty =
            params.movementType === "RECONCILIATION"
              ? roundQty(params.quantityOrCountedStock)
              : params.movementType === "ADJUSTMENT_IN"
              ? roundQty(prevQty + params.quantityOrCountedStock)
              : roundQty(Math.max(0, prevQty - params.quantityOrCountedStock));
          mov = {
            id: makeId("mov"),
            businessId: biz.id,
            ownerId: biz.ownerId,
            memberUids: biz.memberUids,
            productId: p.id,
            productName: p.name,
            movementType: params.movementType,
            quantityDelta: roundQty(nextQty - prevQty),
            previousStock: prevQty,
            newStock: nextQty,
            unitCost: p.purchaseCost,
            reason: params.reason,
            referenceType: "ADJUSTMENT",
            referenceId: makeId("adj"),
            performedBy: biz.ownerId,
            transactionDate: new Date().toISOString(),
          };
          return { ...p, currentStock: nextQty };
        });

        const nextVariants = prev.variants.map((v) => {
          if (v.id !== params.variantId) return v;
          const prevQty = v.currentStock;
          const nextQty =
            params.movementType === "RECONCILIATION"
              ? roundQty(params.quantityOrCountedStock)
              : params.movementType === "ADJUSTMENT_IN"
              ? roundQty(prevQty + params.quantityOrCountedStock)
              : roundQty(Math.max(0, prevQty - params.quantityOrCountedStock));
          const prodName = prev.products.find((p) => p.id === v.productId)?.name || "Product";
          mov = {
            id: makeId("mov"),
            businessId: biz.id,
            ownerId: biz.ownerId,
            memberUids: biz.memberUids,
            productId: v.productId,
            variantId: v.id,
            productName: `${prodName} (${v.variantName})`,
            movementType: params.movementType,
            quantityDelta: roundQty(nextQty - prevQty),
            previousStock: prevQty,
            newStock: nextQty,
            unitCost: v.purchaseCost,
            reason: params.reason,
            referenceType: "ADJUSTMENT",
            referenceId: makeId("adj"),
            performedBy: biz.ownerId,
            transactionDate: new Date().toISOString(),
          };
          return { ...v, currentStock: nextQty };
        });

        return {
          ...prev,
          products: nextProducts,
          variants: nextVariants,
          movements: mov ? [mov, ...prev.movements] : prev.movements,
        };
      });
    },
    [updateSampleBundle]
  );

  const sampleReceivePurchase = useCallback(
    (purchaseId: string) => {
      updateSampleBundle((prev) => {
        const pur = prev.purchases.find((p) => p.id === purchaseId);
        if (!pur || pur.stockReceived) return prev;
        const items = prev.purchaseItems.filter((it) => it.purchaseId === purchaseId);
        const nextProducts = [...prev.products];
        const nextMovs = [...prev.movements];
        for (const it of items) {
          const idx = nextProducts.findIndex((p) => p.id === it.productId);
          if (idx >= 0) {
            const old = nextProducts[idx];
            const nextStock = roundQty(old.currentStock + it.quantity);
            const newCost =
              nextStock > 0
                ? roundMoney((old.currentStock * old.purchaseCost + it.quantity * it.unitCost) / nextStock)
                : it.unitCost;
            nextProducts[idx] = { ...old, currentStock: nextStock, purchaseCost: newCost };
            nextMovs.unshift({
              id: makeId("mov"),
              businessId: prev.business.id,
              ownerId: prev.business.ownerId,
              memberUids: prev.business.memberUids,
              productId: it.productId,
              productName: it.productName,
              movementType: "PURCHASE_IN",
              quantityDelta: it.quantity,
              previousStock: old.currentStock,
              newStock: nextStock,
              unitCost: it.unitCost,
              reason: `Goods received (${pur.invoiceNumber})`,
              referenceType: "PURCHASE",
              referenceId: purchaseId,
              performedBy: prev.business.ownerId,
              transactionDate: new Date().toISOString(),
            });
          }
        }
        return {
          ...prev,
          products: nextProducts,
          movements: nextMovs,
          purchases: prev.purchases.map((p) =>
            p.id === purchaseId ? { ...p, status: "RECEIVED", stockReceived: true } : p
          ),
        };
      });
    },
    [updateSampleBundle]
  );

  const sampleRecordPayment = useCallback(
    (
      partyType: "CUSTOMER" | "SUPPLIER",
      partyId: string,
      amount: number,
      method: SimplePaymentMethod,
      purchaseId?: string
    ) => {
      updateSampleBundle((prev) => {
        const biz = prev.business;
        let partyName = "";
        const nextCustomers =
          partyType === "CUSTOMER"
            ? prev.customers.map((c) => {
                if (c.id !== partyId) return c;
                partyName = c.name;
                return { ...c, outstandingCredit: Math.max(0, roundMoney(c.outstandingCredit - amount)) };
              })
            : prev.customers;
        const nextSuppliers =
          partyType === "SUPPLIER"
            ? prev.suppliers.map((s) => {
                if (s.id !== partyId) return s;
                partyName = s.name;
                return { ...s, outstandingPayable: Math.max(0, roundMoney(s.outstandingPayable - amount)) };
              })
            : prev.suppliers;
        const nextPurchases = purchaseId
          ? prev.purchases.map((p) => {
              if (p.id !== purchaseId) return p;
              const newPaid = roundMoney(p.amountPaid + amount);
              const newOut = Math.max(0, roundMoney(p.totalAmount - newPaid));
              return {
                ...p,
                amountPaid: newPaid,
                outstandingAmount: newOut,
                paymentStatus: newOut <= 0 ? ("PAID" as const) : ("PARTIAL" as const),
              };
            })
          : prev.purchases;

        return {
          ...prev,
          customers: nextCustomers,
          suppliers: nextSuppliers,
          purchases: nextPurchases,
          payments: [
            {
              id: makeId("pay"),
              businessId: biz.id,
              ownerId: biz.ownerId,
              memberUids: biz.memberUids,
              partyType,
              partyId,
              partyName: partyName || "Party",
              amount,
              paymentMethod: method,
              paymentDate: toLocalDateKey(),
              referenceId: purchaseId || partyId,
            },
            ...prev.payments,
          ],
        };
      });
    },
    [updateSampleBundle]
  );

  const value: StoreContextValue = {
    user,
    authReady,
    userProfile,
    businesses,
    activeBusiness,
    userRole,
    isSampleMode,
    isOnline,
    dataLoading,
    products: isSampleMode ? sampleBundle.products : products,
    variants: isSampleMode ? sampleBundle.variants : variants,
    movements: isSampleMode ? sampleBundle.movements : movements,
    sales: isSampleMode ? sampleBundle.sales : sales,
    saleItems: isSampleMode ? sampleBundle.saleItems : saleItems,
    purchases: isSampleMode ? sampleBundle.purchases : purchases,
    purchaseItems: isSampleMode ? sampleBundle.purchaseItems : purchaseItems,
    expenses: isSampleMode ? sampleBundle.expenses : expenses,
    customers: isSampleMode ? sampleBundle.customers : customers,
    suppliers: isSampleMode ? sampleBundle.suppliers : suppliers,
    payments: isSampleMode ? sampleBundle.payments : payments,
    notifications,
    auditLogs: isSampleMode ? sampleBundle.auditLogs : auditLogs,
    pendingOfflineSales,
    activeTab,
    setActiveTab,
    enterSampleMode,
    clearSampleMode,
    resetSampleData,
    updateSampleBundle,
    switchBusiness,
    logoutUser,
    syncOfflineSales,
    refreshOfflineQueue,
    toasts,
    showToast,
    dismissToast,
    sampleCompleteSale,
    sampleAdjustStock,
    sampleReceivePurchase,
    sampleRecordPayment,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
