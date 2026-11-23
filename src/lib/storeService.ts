import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "./firebase";
import { roundMoney, roundQty, toLocalDateKey } from "./finance";
import type {
  Business,
  BusinessCategory,
  BusinessRole,
  CartLineItem,
  Customer,
  DateFormatOption,
  Expense,
  ExpenseCategory,
  LanguageCode,
  MovementType,
  PaymentBreakdown,
  PaymentMethod,
  Product,
  ProductUnit,
  ProductVariant,
  Purchase,
  Sale,
  SaleItem,
  SimplePaymentMethod,
  Supplier,
  UserProfile,
} from "../types/retail";

export function makeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

function clampStr(value: string | undefined, maxLen: number): string {
  return (value ?? "").trim().slice(0, maxLen);
}

function optStr(value: string | undefined, maxLen: number): string | undefined {
  const trimmed = (value ?? "").trim().slice(0, maxLen);
  return trimmed.length > 0 ? trimmed : undefined;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      out[k] = v;
    }
  }
  return out as T;
}

export async function upsertUserProfile(params: {
  uid: string;
  email: string;
  displayName: string;
  preferredLanguage?: LanguageCode;
  activeBusinessId?: string;
}): Promise<void> {
  const path = `users/${params.uid}`;
  const ref = doc(db, "users", params.uid);
  try {
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      const payload = stripUndefined({
        uid: params.uid,
        email: clampStr(params.email, 200),
        displayName: clampStr(params.displayName || params.email.split("@")[0] || "Owner", 120),
        preferredLanguage: params.preferredLanguage || "en",
        activeBusinessId: optStr(params.activeBusinessId, 128),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await setDoc(ref, payload);
    } else {
      const updates: Record<string, unknown> = {
        displayName: clampStr(params.displayName || existing.data().displayName || "Owner", 120),
        updatedAt: serverTimestamp(),
      };
      if (params.preferredLanguage) updates.preferredLanguage = params.preferredLanguage;
      if (params.activeBusinessId) updates.activeBusinessId = clampStr(params.activeBusinessId, 128);
      await updateDoc(ref, updates);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateActiveBusiness(uid: string, businessId: string): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, "users", uid), {
      activeBusinessId: clampStr(businessId, 128),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createBusiness(params: {
  ownerUid: string;
  name: string;
  ownerName: string;
  category: BusinessCategory;
  phone?: string;
  email?: string;
  address?: string;
  country: string;
  currency: string;
  language: LanguageCode;
  dateFormat?: DateFormatOption;
  financialYearStartMonth?: number;
}): Promise<string> {
  const businessId = makeId("biz");
  const path = `businesses/${businessId}`;
  try {
    const batch = writeBatch(db);
    const bizRef = doc(db, "businesses", businessId);
    const payload = stripUndefined({
      id: businessId,
      ownerId: params.ownerUid,
      memberUids: [params.ownerUid],
      memberRoles: { [params.ownerUid]: "OWNER" as BusinessRole },
      name: clampStr(params.name, 120),
      ownerName: clampStr(params.ownerName, 120),
      category: params.category,
      phone: optStr(params.phone, 30),
      email: optStr(params.email, 200),
      address: optStr(params.address, 300),
      country: clampStr(params.country || "India", 80),
      currency: clampStr(params.currency || "INR", 10),
      language: params.language || "en",
      dateFormat: params.dateFormat || "DD/MM/YYYY",
      financialYearStartMonth: params.financialYearStartMonth || 4,
      taxEnabled: false,
      defaultTaxRate: 0,
      receiptFooter: "Thank you for shopping with us!",
      lowStockAlertsEnabled: true,
      dailySummaryAlertsEnabled: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(bizRef, payload);

    const userRef = doc(db, "users", params.ownerUid);
    batch.update(userRef, {
      activeBusinessId: businessId,
      preferredLanguage: params.language || "en",
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    return businessId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateBusinessSettings(
  businessId: string,
  updates: Partial<
    Pick<
      Business,
      | "name"
      | "ownerName"
      | "category"
      | "phone"
      | "email"
      | "address"
      | "country"
      | "currency"
      | "language"
      | "dateFormat"
      | "financialYearStartMonth"
      | "taxEnabled"
      | "defaultTaxRate"
      | "receiptFooter"
      | "lowStockAlertsEnabled"
      | "dailySummaryAlertsEnabled"
    >
  >
): Promise<void> {
  const path = `businesses/${businessId}`;
  try {
    const clean = stripUndefined({
      name: updates.name !== undefined ? clampStr(updates.name, 120) : undefined,
      ownerName: updates.ownerName !== undefined ? clampStr(updates.ownerName, 120) : undefined,
      category: updates.category,
      phone: updates.phone !== undefined ? clampStr(updates.phone, 30) : undefined,
      email: updates.email !== undefined ? clampStr(updates.email, 200) : undefined,
      address: updates.address !== undefined ? clampStr(updates.address, 300) : undefined,
      country: updates.country !== undefined ? clampStr(updates.country, 80) : undefined,
      currency: updates.currency !== undefined ? clampStr(updates.currency, 10) : undefined,
      language: updates.language,
      dateFormat: updates.dateFormat,
      financialYearStartMonth: updates.financialYearStartMonth,
      taxEnabled: updates.taxEnabled,
      defaultTaxRate: updates.defaultTaxRate,
      receiptFooter: updates.receiptFooter !== undefined ? clampStr(updates.receiptFooter, 240) : undefined,
      lowStockAlertsEnabled: updates.lowStockAlertsEnabled,
      dailySummaryAlertsEnabled: updates.dailySummaryAlertsEnabled,
      updatedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, "businesses", businessId), clean);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateBusinessMembers(params: {
  business: Business;
  memberUids: string[];
  memberRoles: Record<string, BusinessRole>;
  productIds: string[];
  variantIds: string[];
  customerIds: string[];
  supplierIds: string[];
  expenseIds: string[];
}): Promise<void> {
  const { business, memberUids, memberRoles } = params;
  const path = `businesses/${business.id}`;
  const cleanUids = Array.from(new Set([business.ownerId, ...memberUids])).slice(0, 25);
  const cleanRoles: Record<string, BusinessRole> = {
    ...memberRoles,
    [business.ownerId]: "OWNER",
  };
  for (const key of Object.keys(cleanRoles)) {
    if (!cleanUids.includes(key)) {
      delete cleanRoles[key];
    }
  }

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, "businesses", business.id), {
      memberUids: cleanUids,
      memberRoles: cleanRoles,
      updatedAt: serverTimestamp(),
    });

    // Sync memberUids across mutable operational collections (stay within Firestore 500-op batch safety limit)
    let opCount = 1;
    const syncSub = (subName: string, ids: string[]) => {
      for (const id of ids) {
        if (opCount >= 450) break;
        batch.update(doc(db, "businesses", business.id, subName, id), {
          memberUids: cleanUids,
          updatedAt: serverTimestamp(),
        });
        opCount++;
      }
    };

    syncSub("products", params.productIds);
    syncSub("product_variants", params.variantIds);
    syncSub("customers", params.customerIds);
    syncSub("suppliers", params.supplierIds);
    syncSub("expenses", params.expenseIds);

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveProduct(params: {
  business: Business;
  actorUid: string;
  actorName: string;
  productId?: string;
  data: {
    name: string;
    sku: string;
    barcode?: string;
    category: string;
    brand?: string;
    description?: string;
    unit: ProductUnit;
    purchaseCost: number;
    sellingPrice: number;
    currentStock: number;
    minStockLevel: number;
    supplierId?: string;
    supplierName?: string;
    taxRate: number;
    expiryDate?: string;
    imageUrl?: string;
    hasVariants: boolean;
    isActive: boolean;
  };
}): Promise<string> {
  const { business, actorUid, actorName, data } = params;
  const isNew = !params.productId;
  const productId = params.productId || makeId("prd");
  const path = `businesses/${business.id}/products/${productId}`;

  try {
    if (isNew) {
      const batch = writeBatch(db);
      const prodRef = doc(db, "businesses", business.id, "products", productId);
      const initialStock = Math.max(0, roundQty(data.currentStock));

      batch.set(
        prodRef,
        stripUndefined({
          id: productId,
          businessId: business.id,
          ownerId: business.ownerId,
          memberUids: business.memberUids,
          name: clampStr(data.name, 160),
          sku: clampStr(data.sku, 64),
          barcode: optStr(data.barcode, 64),
          category: clampStr(data.category || "General", 80),
          brand: optStr(data.brand, 80),
          description: optStr(data.description, 500),
          unit: data.unit,
          purchaseCost: Math.max(0, roundMoney(data.purchaseCost)),
          sellingPrice: Math.max(0, roundMoney(data.sellingPrice)),
          currentStock: initialStock,
          minStockLevel: Math.max(0, roundQty(data.minStockLevel)),
          supplierId: optStr(data.supplierId, 128),
          supplierName: optStr(data.supplierName, 120),
          taxRate: Math.max(0, Math.min(100, roundMoney(data.taxRate))),
          expiryDate: optStr(data.expiryDate, 32),
          imageUrl: optStr(data.imageUrl, 500),
          hasVariants: Boolean(data.hasVariants),
          isActive: data.isActive,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );

      if (initialStock > 0) {
        const movId = makeId("mov");
        batch.set(doc(db, "businesses", business.id, "inventory_movements", movId), {
          id: movId,
          businessId: business.id,
          ownerId: business.ownerId,
          memberUids: business.memberUids,
          productId,
          productName: clampStr(data.name, 160),
          movementType: "OPENING_STOCK" as MovementType,
          quantityDelta: initialStock,
          previousStock: 0,
          newStock: initialStock,
          unitCost: Math.max(0, roundMoney(data.purchaseCost)),
          reason: "Opening stock entered on product creation",
          referenceType: "PRODUCT_INIT",
          referenceId: productId,
          performedBy: actorUid,
          transactionDate: new Date().toISOString(),
          createdAt: serverTimestamp(),
        });
      }

      const logId = makeId("log");
      batch.set(doc(db, "businesses", business.id, "audit_logs", logId), {
        id: logId,
        businessId: business.id,
        ownerId: business.ownerId,
        memberUids: business.memberUids,
        action: "PRODUCT_CREATED",
        entityType: "PRODUCT",
        entityId: productId,
        summary: clampStr(`Created product ${data.name} with opening stock ${initialStock} ${data.unit}`, 300),
        actorUid,
        actorName: clampStr(actorName, 120),
        createdAt: serverTimestamp(),
      });

      await batch.commit();
    } else {
      await updateDoc(
        doc(db, "businesses", business.id, "products", productId),
        stripUndefined({
          name: clampStr(data.name, 160),
          sku: clampStr(data.sku, 64),
          barcode: clampStr(data.barcode, 64),
          category: clampStr(data.category || "General", 80),
          brand: clampStr(data.brand, 80),
          description: clampStr(data.description, 500),
          unit: data.unit,
          purchaseCost: Math.max(0, roundMoney(data.purchaseCost)),
          sellingPrice: Math.max(0, roundMoney(data.sellingPrice)),
          minStockLevel: Math.max(0, roundQty(data.minStockLevel)),
          supplierId: clampStr(data.supplierId, 128),
          supplierName: clampStr(data.supplierName, 120),
          taxRate: Math.max(0, Math.min(100, roundMoney(data.taxRate))),
          expiryDate: clampStr(data.expiryDate, 32),
          imageUrl: clampStr(data.imageUrl, 500),
          hasVariants: Boolean(data.hasVariants),
          isActive: data.isActive,
          updatedAt: serverTimestamp(),
        })
      );
    }
    return productId;
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function saveProductVariant(params: {
  business: Business;
  actorUid: string;
  product: Product;
  variantId?: string;
  data: {
    variantName: string;
    sku: string;
    purchaseCost: number;
    sellingPrice: number;
    currentStock: number;
    minStockLevel: number;
    isActive: boolean;
  };
}): Promise<string> {
  const { business, actorUid, product, data } = params;
  const isNew = !params.variantId;
  const variantId = params.variantId || makeId("var");
  const path = `businesses/${business.id}/product_variants/${variantId}`;

  try {
    if (isNew) {
      const batch = writeBatch(db);
      const initialStock = Math.max(0, roundQty(data.currentStock));
      batch.set(doc(db, "businesses", business.id, "product_variants", variantId), {
        id: variantId,
        businessId: business.id,
        ownerId: business.ownerId,
        memberUids: business.memberUids,
        productId: product.id,
        variantName: clampStr(data.variantName, 100),
        sku: clampStr(data.sku, 64),
        purchaseCost: Math.max(0, roundMoney(data.purchaseCost)),
        sellingPrice: Math.max(0, roundMoney(data.sellingPrice)),
        currentStock: initialStock,
        minStockLevel: Math.max(0, roundQty(data.minStockLevel)),
        isActive: data.isActive,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (initialStock > 0) {
        const movId = makeId("mov");
        batch.set(doc(db, "businesses", business.id, "inventory_movements", movId), {
          id: movId,
          businessId: business.id,
          ownerId: business.ownerId,
          memberUids: business.memberUids,
          productId: product.id,
          variantId,
          productName: clampStr(`${product.name} (${data.variantName})`, 160),
          movementType: "OPENING_STOCK" as MovementType,
          quantityDelta: initialStock,
          previousStock: 0,
          newStock: initialStock,
          unitCost: Math.max(0, roundMoney(data.purchaseCost)),
          reason: "Opening stock entered on variant creation",
          referenceType: "PRODUCT_INIT",
          referenceId: variantId,
          performedBy: actorUid,
          transactionDate: new Date().toISOString(),
          createdAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } else {
      await updateDoc(doc(db, "businesses", business.id, "product_variants", variantId), {
        variantName: clampStr(data.variantName, 100),
        sku: clampStr(data.sku, 64),
        purchaseCost: Math.max(0, roundMoney(data.purchaseCost)),
        sellingPrice: Math.max(0, roundMoney(data.sellingPrice)),
        minStockLevel: Math.max(0, roundQty(data.minStockLevel)),
        isActive: data.isActive,
        updatedAt: serverTimestamp(),
      });
    }
    return variantId;
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function adjustStock(params: {
  business: Business;
  actorUid: string;
  actorName: string;
  productId: string;
  variantId?: string;
  movementType: "ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "DAMAGED_OUT" | "EXPIRED_OUT" | "RECONCILIATION";
  quantityOrCountedStock: number;
  reason: string;
}): Promise<void> {
  const { business, actorUid, actorName, productId, variantId, movementType, quantityOrCountedStock, reason } = params;
  const path = `businesses/${business.id}/products/${productId}`;

  try {
    await runTransaction(db, async (tx) => {
      const prodRef = doc(db, "businesses", business.id, "products", productId);
      const prodSnap = await tx.get(prodRef);
      if (!prodSnap.exists()) throw new Error("Product not found.");
      const product = prodSnap.data() as Product;

      let prevStock = product.currentStock;
      let targetLabel = product.name;
      let targetCost = product.purchaseCost;

      if (variantId) {
        const varRef = doc(db, "businesses", business.id, "product_variants", variantId);
        const varSnap = await tx.get(varRef);
        if (!varSnap.exists()) throw new Error("Product variation not found.");
        const variant = varSnap.data() as ProductVariant;
        prevStock = variant.currentStock;
        targetLabel = `${product.name} (${variant.variantName})`;
        targetCost = variant.purchaseCost;

        const { nextStock, delta } = computeAdjustmentStock(prevStock, movementType, quantityOrCountedStock);
        tx.update(varRef, { currentStock: nextStock, updatedAt: serverTimestamp() });

        const movId = makeId("mov");
        tx.set(doc(db, "businesses", business.id, "inventory_movements", movId), {
          id: movId,
          businessId: business.id,
          ownerId: business.ownerId,
          memberUids: business.memberUids,
          productId,
          variantId,
          productName: clampStr(targetLabel, 160),
          movementType,
          quantityDelta: delta,
          previousStock: prevStock,
          newStock: nextStock,
          unitCost: targetCost,
          reason: clampStr(reason || movementType, 240),
          referenceType: "ADJUSTMENT",
          referenceId: movId,
          performedBy: actorUid,
          transactionDate: new Date().toISOString(),
          createdAt: serverTimestamp(),
        });
      } else {
        const { nextStock, delta } = computeAdjustmentStock(prevStock, movementType, quantityOrCountedStock);
        tx.update(prodRef, { currentStock: nextStock, updatedAt: serverTimestamp() });

        const movId = makeId("mov");
        tx.set(doc(db, "businesses", business.id, "inventory_movements", movId), {
          id: movId,
          businessId: business.id,
          ownerId: business.ownerId,
          memberUids: business.memberUids,
          productId,
          productName: clampStr(targetLabel, 160),
          movementType,
          quantityDelta: delta,
          previousStock: prevStock,
          newStock: nextStock,
          unitCost: targetCost,
          reason: clampStr(reason || movementType, 240),
          referenceType: "ADJUSTMENT",
          referenceId: movId,
          performedBy: actorUid,
          transactionDate: new Date().toISOString(),
          createdAt: serverTimestamp(),
        });
      }

      const logId = makeId("log");
      tx.set(doc(db, "businesses", business.id, "audit_logs", logId), {
        id: logId,
        businessId: business.id,
        ownerId: business.ownerId,
        memberUids: business.memberUids,
        action: `STOCK_${movementType}`,
        entityType: "PRODUCT",
        entityId: variantId || productId,
        summary: clampStr(`${movementType} on ${targetLabel}: ${reason}`, 300),
        actorUid,
        actorName: clampStr(actorName, 120),
        createdAt: serverTimestamp(),
      });
    });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Insufficient") || error.message.includes("not found") || error.message.includes("cannot be negative"))) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

function computeAdjustmentStock(
  prevStock: number,
  movementType: "ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "DAMAGED_OUT" | "EXPIRED_OUT" | "RECONCILIATION",
  quantityOrCountedStock: number
): { nextStock: number; delta: number } {
  const safeVal = roundQty(quantityOrCountedStock);
  if (safeVal < 0) throw new Error("Quantity cannot be negative.");
  if (movementType === "RECONCILIATION") {
    return {
      nextStock: safeVal,
      delta: roundQty(safeVal - prevStock),
    };
  }
  if (movementType === "ADJUSTMENT_IN") {
    return {
      nextStock: roundQty(prevStock + safeVal),
      delta: safeVal,
    };
  }
  if (prevStock < safeVal) {
    throw new Error(`Insufficient stock (${prevStock} available) to deduct ${safeVal}.`);
  }
  return {
    nextStock: roundQty(prevStock - safeVal),
    delta: roundQty(-safeVal),
  };
}

export async function completeSale(params: {
  business: Business;
  actorUid: string;
  actorName: string;
  idempotencyKey?: string;
  transactionDate?: string;
  items: CartLineItem[];
  discountAmount: number;
  paymentMethod: PaymentMethod;
  paymentBreakdown: PaymentBreakdown;
  customerId?: string;
  customerName?: string;
  notes?: string;
}): Promise<Sale> {
  const {
    business,
    actorUid,
    actorName,
    idempotencyKey,
    items,
    discountAmount,
    paymentMethod,
    paymentBreakdown,
    customerId,
    customerName,
    notes,
  } = params;

  if (!items || items.length === 0) {
    throw new Error("Add at least one product before completing a sale.");
  }

  const saleId = idempotencyKey || makeId("sal");
  const path = `businesses/${business.id}/sales/${saleId}`;
  const txDate = params.transactionDate || new Date().toISOString();
  const receiptNumber = `RM-${saleId.slice(-6).toUpperCase()}`;

  try {
    return await runTransaction(db, async (tx) => {
      const saleRef = doc(db, "businesses", business.id, "sales", saleId);
      const existingSaleSnap = await tx.get(saleRef);
      if (existingSaleSnap.exists()) {
        // Idempotent duplicate submission guard
        return existingSaleSnap.data() as Sale;
      }

      // 1. ALL READS FIRST (Firestore transaction requirement)
      const stockTargets = new Map<
        string,
        {
          kind: "product" | "variant";
          ref: ReturnType<typeof doc>;
          currentStock: number;
          cost: number;
          name: string;
          unit: string;
        }
      >();

      for (const item of items) {
        const prodRef = doc(db, "businesses", business.id, "products", item.productId);
        const prodSnap = await tx.get(prodRef);
        if (!prodSnap.exists()) {
          throw new Error(`Product "${item.productName}" no longer exists.`);
        }
        const prod = prodSnap.data() as Product;

        if (item.variantId) {
          const varKey = `v:${item.variantId}`;
          if (!stockTargets.has(varKey)) {
            const varRef = doc(db, "businesses", business.id, "product_variants", item.variantId);
            const varSnap = await tx.get(varRef);
            if (!varSnap.exists()) {
              throw new Error(`Variation for "${item.productName}" not found.`);
            }
            const variant = varSnap.data() as ProductVariant;
            stockTargets.set(varKey, {
              kind: "variant",
              ref: varRef,
              currentStock: variant.currentStock,
              cost: variant.purchaseCost,
              name: `${prod.name} (${variant.variantName})`,
              unit: prod.unit,
            });
          }
        } else {
          const prodKey = `p:${item.productId}`;
          if (!stockTargets.has(prodKey)) {
            stockTargets.set(prodKey, {
              kind: "product",
              ref: prodRef,
              currentStock: prod.currentStock,
              cost: prod.purchaseCost,
              name: prod.name,
              unit: prod.unit,
            });
          }
        }
      }

      let customerSnapData: Customer | null = null;
      const customerRef = customerId ? doc(db, "businesses", business.id, "customers", customerId) : null;
      if (customerRef) {
        const cSnap = await tx.get(customerRef);
        if (cSnap.exists()) {
          customerSnapData = cSnap.data() as Customer;
        }
      }

      // 2. VALIDATE STOCK & COMPUTE TOTALS
      let subtotal = 0;
      let taxAmount = 0;
      let totalCost = 0;

      const requestedQtyMap = new Map<string, number>();
      for (const item of items) {
        if (item.quantity <= 0) throw new Error(`Invalid quantity for ${item.productName}.`);
        const key = item.variantId ? `v:${item.variantId}` : `p:${item.productId}`;
        requestedQtyMap.set(key, roundQty((requestedQtyMap.get(key) || 0) + item.quantity));
      }

      for (const [key, reqQty] of requestedQtyMap.entries()) {
        const target = stockTargets.get(key)!;
        if (target.currentStock < reqQty) {
          throw new Error(
            `Insufficient stock for "${target.name}". Available: ${target.currentStock} ${target.unit}, requested: ${reqQty} ${target.unit}.`
          );
        }
      }

      const itemRecords: Array<{ item: SaleItem; targetKey: string; costSnap: number }> = [];
      for (const item of items) {
        const key = item.variantId ? `v:${item.variantId}` : `p:${item.productId}`;
        const target = stockTargets.get(key)!;
        const lineGross = roundMoney(item.unitPrice * item.quantity);
        const effTaxRate = business.taxEnabled ? item.taxRate : 0;
        const lineTax = roundMoney((lineGross * effTaxRate) / 100);
        const lineTotal = roundMoney(lineGross + lineTax);
        const costSnap = target.cost;

        subtotal = roundMoney(subtotal + lineGross);
        taxAmount = roundMoney(taxAmount + lineTax);
        totalCost = roundMoney(totalCost + costSnap * item.quantity);

        const itemId = makeId("sit");
        itemRecords.push({
          targetKey: key,
          costSnap,
          item: stripUndefined({
            id: itemId,
            businessId: business.id,
            ownerId: business.ownerId,
            memberUids: business.memberUids,
            saleId,
            productId: item.productId,
            variantId: item.variantId,
            productName: clampStr(target.name, 160),
            unit: clampStr(target.unit, 20),
            quantity: roundQty(item.quantity),
            returnedQuantity: 0,
            unitPrice: roundMoney(item.unitPrice),
            unitCostSnapshot: roundMoney(costSnap),
            discountAmount: 0,
            taxRate: roundMoney(effTaxRate),
            taxAmount: lineTax,
            lineTotal,
            transactionDate: txDate,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }) as SaleItem,
        });
      }

      const safeDiscount = Math.min(subtotal, Math.max(0, roundMoney(discountAmount)));
      const totalAmount = Math.max(0, roundMoney(subtotal - safeDiscount + taxAmount));
      const paidAmount = roundMoney(
        (paymentBreakdown.cash || 0) +
          (paymentBreakdown.upi || 0) +
          (paymentBreakdown.card || 0) +
          (paymentBreakdown.bankTransfer || 0)
      );
      const creditAmount = roundMoney(paymentBreakdown.credit || 0);

      // 3. ALL WRITES
      const runningStockMap = new Map<string, number>();
      for (const [k, t] of stockTargets.entries()) {
        runningStockMap.set(k, t.currentStock);
      }

      for (const rec of itemRecords) {
        const prev = runningStockMap.get(rec.targetKey)!;
        const next = roundQty(prev - rec.item.quantity);
        runningStockMap.set(rec.targetKey, next);

        const movId = makeId("mov");
        tx.set(
          doc(db, "businesses", business.id, "inventory_movements", movId),
          stripUndefined({
            id: movId,
            businessId: business.id,
            ownerId: business.ownerId,
            memberUids: business.memberUids,
            productId: rec.item.productId,
            variantId: rec.item.variantId,
            productName: rec.item.productName,
            movementType: "SALE_OUT" as MovementType,
            quantityDelta: roundQty(-rec.item.quantity),
            previousStock: prev,
            newStock: next,
            unitCost: rec.costSnap,
            reason: `Sold on receipt ${receiptNumber}`,
            referenceType: "SALE",
            referenceId: saleId,
            performedBy: actorUid,
            transactionDate: txDate,
            createdAt: serverTimestamp(),
          })
        );

        tx.set(doc(db, "businesses", business.id, "sale_items", rec.item.id), rec.item);
      }

      for (const [key, target] of stockTargets.entries()) {
        const finalStock = runningStockMap.get(key)!;
        tx.update(target.ref, {
          currentStock: finalStock,
          updatedAt: serverTimestamp(),
        });
      }

      const salePayload = stripUndefined({
        id: saleId,
        businessId: business.id,
        ownerId: business.ownerId,
        memberUids: business.memberUids,
        receiptNumber,
        transactionDate: txDate,
        subtotal,
        discountAmount: safeDiscount,
        taxAmount,
        totalAmount,
        totalCost,
        paidAmount,
        creditAmount,
        refundedAmount: 0,
        paymentMethod,
        paymentBreakdown: {
          cash: roundMoney(paymentBreakdown.cash || 0),
          upi: roundMoney(paymentBreakdown.upi || 0),
          card: roundMoney(paymentBreakdown.card || 0),
          bankTransfer: roundMoney(paymentBreakdown.bankTransfer || 0),
          credit: roundMoney(paymentBreakdown.credit || 0),
        },
        customerId: optStr(customerId, 128),
        customerName: optStr(customerName || customerSnapData?.name, 120),
        staffUid: actorUid,
        staffName: clampStr(actorName, 120),
        status: "COMPLETED" as const,
        itemCount: itemRecords.length,
        notes: optStr(notes, 300),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      tx.set(saleRef, salePayload);

      if (customerRef && customerSnapData) {
        tx.update(customerRef, {
          totalPurchases: roundMoney((customerSnapData.totalPurchases || 0) + totalAmount),
          outstandingCredit: roundMoney((customerSnapData.outstandingCredit || 0) + creditAmount),
          updatedAt: serverTimestamp(),
        });
      }

      const logId = makeId("log");
      tx.set(doc(db, "businesses", business.id, "audit_logs", logId), {
        id: logId,
        businessId: business.id,
        ownerId: business.ownerId,
        memberUids: business.memberUids,
        action: "SALE_COMPLETED",
        entityType: "SALE",
        entityId: saleId,
        summary: clampStr(`Receipt ${receiptNumber}: ${itemRecords.length} item(s), total ${totalAmount}`, 300),
        actorUid,
        actorName: clampStr(actorName, 120),
        createdAt: serverTimestamp(),
      });

      return salePayload as unknown as Sale;
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("Insufficient stock") ||
        error.message.includes("no longer exists") ||
        error.message.includes("Invalid quantity"))
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function returnSaleItems(params: {
  business: Business;
  actorUid: string;
  actorName: string;
  saleId: string;
  returns: Array<{ saleItemId: string; returnQty: number }>;
  restock: boolean;
  reason: string;
}): Promise<void> {
  const { business, actorUid, actorName, saleId, returns, restock, reason } = params;
  const path = `businesses/${business.id}/sales/${saleId}`;

  try {
    await runTransaction(db, async (tx) => {
      const saleRef = doc(db, "businesses", business.id, "sales", saleId);
      const saleSnap = await tx.get(saleRef);
      if (!saleSnap.exists()) throw new Error("Sale record not found.");
      const sale = saleSnap.data() as Sale;
      if (sale.status === "CANCELLED") {
        throw new Error("Cannot return items on an already cancelled sale.");
      }

      const itemSnaps = [];
      for (const r of returns) {
        if (r.returnQty <= 0) continue;
        const itemRef = doc(db, "businesses", business.id, "sale_items", r.saleItemId);
        const snap = await tx.get(itemRef);
        if (!snap.exists()) throw new Error("Sale item not found.");
        itemSnaps.push({ ref: itemRef, item: snap.data() as SaleItem, returnQty: roundQty(r.returnQty) });
      }
      if (itemSnaps.length === 0) throw new Error("Select at least one item quantity to return.");

      // Read product/variant docs for restock
      const stockTargets = new Map<string, { ref: ReturnType<typeof doc>; currentStock: number }>();
      if (restock) {
        for (const entry of itemSnaps) {
          const key = entry.item.variantId ? `v:${entry.item.variantId}` : `p:${entry.item.productId}`;
          if (!stockTargets.has(key)) {
            const targetRef = entry.item.variantId
              ? doc(db, "businesses", business.id, "product_variants", entry.item.variantId)
              : doc(db, "businesses", business.id, "products", entry.item.productId);
            const snap = await tx.get(targetRef);
            if (snap.exists()) {
              stockTargets.set(key, {
                ref: targetRef,
                currentStock: (snap.data() as { currentStock: number }).currentStock,
              });
            }
          }
        }
      }

      let customerSnapData: Customer | null = null;
      const customerRef = sale.customerId ? doc(db, "businesses", business.id, "customers", sale.customerId) : null;
      if (customerRef) {
        const cSnap = await tx.get(customerRef);
        if (cSnap.exists()) customerSnapData = cSnap.data() as Customer;
      }

      // Compute refund amount & validate remaining quantities
      let addedRefund = 0;
      for (const entry of itemSnaps) {
        const remaining = roundQty(entry.item.quantity - (entry.item.returnedQuantity || 0));
        if (entry.returnQty > remaining) {
          throw new Error(
            `Cannot return ${entry.returnQty} of ${entry.item.productName}; only ${remaining} remaining.`
          );
        }
        const perUnitLine = entry.item.quantity > 0 ? entry.item.lineTotal / entry.item.quantity : 0;
        const discountFactor =
          sale.subtotal > 0 ? Math.max(0, (sale.subtotal - sale.discountAmount) / sale.subtotal) : 1;
        addedRefund = roundMoney(addedRefund + perUnitLine * discountFactor * entry.returnQty);
      }

      const newRefunded = Math.min(sale.totalAmount, roundMoney((sale.refundedAmount || 0) + addedRefund));
      const fullyReturned = newRefunded >= roundMoney(sale.totalAmount - 0.01);

      for (const entry of itemSnaps) {
        tx.update(entry.ref, {
          returnedQuantity: roundQty((entry.item.returnedQuantity || 0) + entry.returnQty),
          updatedAt: serverTimestamp(),
        });

        if (restock) {
          const key = entry.item.variantId ? `v:${entry.item.variantId}` : `p:${entry.item.productId}`;
          const target = stockTargets.get(key);
          if (target) {
            const prev = target.currentStock;
            const next = roundQty(prev + entry.returnQty);
            target.currentStock = next;
            tx.update(target.ref, { currentStock: next, updatedAt: serverTimestamp() });

            const movId = makeId("mov");
            tx.set(doc(db, "businesses", business.id, "inventory_movements", movId), {
              id: movId,
              businessId: business.id,
              ownerId: business.ownerId,
              memberUids: business.memberUids,
              productId: entry.item.productId,
              variantId: entry.item.variantId,
              productName: entry.item.productName,
              movementType: "CUSTOMER_RETURN_IN" as MovementType,
              quantityDelta: entry.returnQty,
              previousStock: prev,
              newStock: next,
              unitCost: entry.item.unitCostSnapshot,
              reason: clampStr(reason || `Customer return on ${sale.receiptNumber}`, 240),
              referenceType: "RETURN",
              referenceId: saleId,
              performedBy: actorUid,
              transactionDate: new Date().toISOString(),
              createdAt: serverTimestamp(),
            });
          }
        }
      }

      const creditReduction = Math.min(sale.creditAmount || 0, addedRefund);
      const nextCredit = Math.max(0, roundMoney((sale.creditAmount || 0) - creditReduction));

      tx.update(saleRef, {
        status: fullyReturned ? "RETURNED" : "PARTIALLY_RETURNED",
        refundedAmount: newRefunded,
        creditAmount: nextCredit,
        notes: clampStr(reason || sale.notes || "Customer return recorded", 300),
        updatedAt: serverTimestamp(),
      });

      if (customerRef && customerSnapData && creditReduction > 0) {
        tx.update(customerRef, {
          totalPurchases: Math.max(0, roundMoney(customerSnapData.totalPurchases - addedRefund)),
          outstandingCredit: Math.max(0, roundMoney(customerSnapData.outstandingCredit - creditReduction)),
          updatedAt: serverTimestamp(),
        });
      }

      const logId = makeId("log");
      tx.set(doc(db, "businesses", business.id, "audit_logs", logId), {
        id: logId,
        businessId: business.id,
        ownerId: business.ownerId,
        memberUids: business.memberUids,
        action: "SALE_RETURN_PROCESSED",
        entityType: "SALE",
        entityId: saleId,
        summary: clampStr(
          `Returned ${itemSnaps.length} line(s) on ${sale.receiptNumber}, refund ${addedRefund}, restocked: ${restock}`,
          300
        ),
        actorUid,
        actorName: clampStr(actorName, 120),
        createdAt: serverTimestamp(),
      });
    });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Cannot return") || error.message.includes("Select"))) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function cancelSale(params: {
  business: Business;
  actorUid: string;
  actorName: string;
  saleId: string;
  saleItems: SaleItem[];
  reason: string;
}): Promise<void> {
  const { business, actorUid, actorName, saleId, saleItems, reason } = params;
  const path = `businesses/${business.id}/sales/${saleId}`;

  try {
    await runTransaction(db, async (tx) => {
      const saleRef = doc(db, "businesses", business.id, "sales", saleId);
      const saleSnap = await tx.get(saleRef);
      if (!saleSnap.exists()) throw new Error("Sale record not found.");
      const sale = saleSnap.data() as Sale;
      if (sale.status === "CANCELLED") {
        throw new Error("This sale has already been cancelled and reversed.");
      }

      const itemsForSale = saleItems.filter((si) => si.saleId === saleId);
      const itemSnaps = [];
      for (const si of itemsForSale) {
        const ref = doc(db, "businesses", business.id, "sale_items", si.id);
        const snap = await tx.get(ref);
        if (snap.exists()) {
          itemSnaps.push({ ref, item: snap.data() as SaleItem });
        }
      }

      const stockTargets = new Map<string, { ref: ReturnType<typeof doc>; currentStock: number }>();
      for (const entry of itemSnaps) {
        const unreturned = roundQty(entry.item.quantity - (entry.item.returnedQuantity || 0));
        if (unreturned <= 0) continue;
        const key = entry.item.variantId ? `v:${entry.item.variantId}` : `p:${entry.item.productId}`;
        if (!stockTargets.has(key)) {
          const targetRef = entry.item.variantId
            ? doc(db, "businesses", business.id, "product_variants", entry.item.variantId)
            : doc(db, "businesses", business.id, "products", entry.item.productId);
          const snap = await tx.get(targetRef);
          if (snap.exists()) {
            stockTargets.set(key, {
              ref: targetRef,
              currentStock: (snap.data() as { currentStock: number }).currentStock,
            });
          }
        }
      }

      let customerSnapData: Customer | null = null;
      const customerRef = sale.customerId ? doc(db, "businesses", business.id, "customers", sale.customerId) : null;
      if (customerRef) {
        const cSnap = await tx.get(customerRef);
        if (cSnap.exists()) customerSnapData = cSnap.data() as Customer;
      }

      // Restore unreturned stock and record reversal movements
      for (const entry of itemSnaps) {
        const unreturned = roundQty(entry.item.quantity - (entry.item.returnedQuantity || 0));
        if (unreturned <= 0) continue;
        const key = entry.item.variantId ? `v:${entry.item.variantId}` : `p:${entry.item.productId}`;
        const target = stockTargets.get(key);
        if (target) {
          const prev = target.currentStock;
          const next = roundQty(prev + unreturned);
          target.currentStock = next;
          tx.update(target.ref, { currentStock: next, updatedAt: serverTimestamp() });

          const movId = makeId("mov");
          tx.set(doc(db, "businesses", business.id, "inventory_movements", movId), {
            id: movId,
            businessId: business.id,
            ownerId: business.ownerId,
            memberUids: business.memberUids,
            productId: entry.item.productId,
            variantId: entry.item.variantId,
            productName: entry.item.productName,
            movementType: "SALE_CANCEL_REVERSAL" as MovementType,
            quantityDelta: unreturned,
            previousStock: prev,
            newStock: next,
            unitCost: entry.item.unitCostSnapshot,
            reason: clampStr(reason || `Sale ${sale.receiptNumber} cancelled/reversed`, 240),
            referenceType: "SALE",
            referenceId: saleId,
            performedBy: actorUid,
            transactionDate: new Date().toISOString(),
            createdAt: serverTimestamp(),
          });
        }
      }

      tx.update(saleRef, {
        status: "CANCELLED",
        refundedAmount: sale.totalAmount,
        creditAmount: 0,
        notes: clampStr(reason || "Sale cancelled and reversed", 300),
        updatedAt: serverTimestamp(),
      });

      if (customerRef && customerSnapData) {
        tx.update(customerRef, {
          totalPurchases: Math.max(0, roundMoney(customerSnapData.totalPurchases - sale.totalAmount)),
          outstandingCredit: Math.max(0, roundMoney(customerSnapData.outstandingCredit - (sale.creditAmount || 0))),
          updatedAt: serverTimestamp(),
        });
      }

      const logId = makeId("log");
      tx.set(doc(db, "businesses", business.id, "audit_logs", logId), {
        id: logId,
        businessId: business.id,
        ownerId: business.ownerId,
        memberUids: business.memberUids,
        action: "SALE_CANCELLED",
        entityType: "SALE",
        entityId: saleId,
        summary: clampStr(`Cancelled sale ${sale.receiptNumber}: ${reason}`, 300),
        actorUid,
        actorName: clampStr(actorName, 120),
        createdAt: serverTimestamp(),
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("already been cancelled")) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function createPurchase(params: {
  business: Business;
  actorUid: string;
  actorName: string;
  supplierId?: string;
  supplierName: string;
  invoiceNumber: string;
  purchaseDate: string;
  items: Array<{
    productId: string;
    variantId?: string;
    productName: string;
    unit: string;
    quantity: number;
    unitCost: number;
    taxAmount: number;
  }>;
  discountAmount: number;
  amountPaid: number;
  receiveNow: boolean;
  statusWhenNotReceived?: "DRAFT" | "ORDERED";
  notes?: string;
}): Promise<string> {
  const {
    business,
    actorUid,
    actorName,
    supplierId,
    supplierName,
    invoiceNumber,
    purchaseDate,
    items,
    discountAmount,
    amountPaid,
    receiveNow,
    statusWhenNotReceived,
    notes,
  } = params;

  if (!items || items.length === 0) {
    throw new Error("Add at least one product to the purchase.");
  }

  const purchaseId = makeId("pur");
  const path = `businesses/${business.id}/purchases/${purchaseId}`;

  try {
    await runTransaction(db, async (tx) => {
      const subtotal = roundMoney(items.reduce((s, it) => s + it.quantity * it.unitCost, 0));
      const taxAmount = roundMoney(items.reduce((s, it) => s + (it.taxAmount || 0), 0));
      const safeDiscount = Math.min(subtotal, Math.max(0, roundMoney(discountAmount)));
      const totalAmount = Math.max(0, roundMoney(subtotal - safeDiscount + taxAmount));
      const safePaid = Math.min(totalAmount, Math.max(0, roundMoney(amountPaid)));
      const outstandingAmount = roundMoney(totalAmount - safePaid);
      const paymentStatus = safePaid <= 0 ? "UNPAID" : outstandingAmount <= 0 ? "PAID" : "PARTIAL";

      const stockTargets = new Map<
        string,
        {
          ref: ReturnType<typeof doc>;
          currentStock: number;
          purchaseCost: number;
        }
      >();

      if (receiveNow) {
        for (const it of items) {
          const key = it.variantId ? `v:${it.variantId}` : `p:${it.productId}`;
          if (!stockTargets.has(key)) {
            const ref = it.variantId
              ? doc(db, "businesses", business.id, "product_variants", it.variantId)
              : doc(db, "businesses", business.id, "products", it.productId);
            const snap = await tx.get(ref);
            if (!snap.exists()) throw new Error(`Product "${it.productName}" not found.`);
            const data = snap.data() as { currentStock: number; purchaseCost: number };
            stockTargets.set(key, {
              ref,
              currentStock: data.currentStock,
              purchaseCost: data.purchaseCost,
            });
          }
        }
      }

      let supplierSnapData: Supplier | null = null;
      const supplierRef = supplierId ? doc(db, "businesses", business.id, "suppliers", supplierId) : null;
      if (supplierRef && receiveNow) {
        const sSnap = await tx.get(supplierRef);
        if (sSnap.exists()) supplierSnapData = sSnap.data() as Supplier;
      }

      const purRef = doc(db, "businesses", business.id, "purchases", purchaseId);
      tx.set(
        purRef,
        stripUndefined({
          id: purchaseId,
          businessId: business.id,
          ownerId: business.ownerId,
          memberUids: business.memberUids,
          supplierId: optStr(supplierId, 128),
          supplierName: clampStr(supplierName, 120),
          invoiceNumber: clampStr(invoiceNumber, 64),
          purchaseDate,
          subtotal,
          taxAmount,
          discountAmount: safeDiscount,
          totalAmount,
          amountPaid: safePaid,
          outstandingAmount,
          paymentStatus,
          status: receiveNow ? "RECEIVED" : statusWhenNotReceived || "ORDERED",
          stockReceived: receiveNow,
          notes: optStr(notes, 300),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );

      for (const it of items) {
        const piId = makeId("pit");
        const lineTotal = roundMoney(it.quantity * it.unitCost + (it.taxAmount || 0));
        tx.set(
          doc(db, "businesses", business.id, "purchase_items", piId),
          stripUndefined({
            id: piId,
            businessId: business.id,
            ownerId: business.ownerId,
            memberUids: business.memberUids,
            purchaseId,
            productId: it.productId,
            variantId: optStr(it.variantId, 128),
            productName: clampStr(it.productName, 160),
            unit: clampStr(it.unit, 20),
            quantity: roundQty(it.quantity),
            unitCost: roundMoney(it.unitCost),
            taxAmount: roundMoney(it.taxAmount || 0),
            lineTotal,
            createdAt: serverTimestamp(),
          })
        );

        if (receiveNow) {
          const key = it.variantId ? `v:${it.variantId}` : `p:${it.productId}`;
          const target = stockTargets.get(key)!;
          const prev = target.currentStock;
          const next = roundQty(prev + it.quantity);
          // Weighted-average inventory costing
          const newWeightedCost =
            next > 0
              ? roundMoney((Math.max(0, prev) * target.purchaseCost + it.quantity * it.unitCost) / next)
              : roundMoney(it.unitCost);

          target.currentStock = next;
          target.purchaseCost = newWeightedCost;
          tx.update(target.ref, {
            currentStock: next,
            purchaseCost: newWeightedCost,
            updatedAt: serverTimestamp(),
          });

          const movId = makeId("mov");
          tx.set(
            doc(db, "businesses", business.id, "inventory_movements", movId),
            stripUndefined({
              id: movId,
              businessId: business.id,
              ownerId: business.ownerId,
              memberUids: business.memberUids,
              productId: it.productId,
              variantId: optStr(it.variantId, 128),
              productName: clampStr(it.productName, 160),
              movementType: "PURCHASE_IN" as MovementType,
              quantityDelta: roundQty(it.quantity),
              previousStock: prev,
              newStock: next,
              unitCost: roundMoney(it.unitCost),
              reason: `Goods received from ${supplierName} (${invoiceNumber})`,
              referenceType: "PURCHASE",
              referenceId: purchaseId,
              performedBy: actorUid,
              transactionDate: new Date().toISOString(),
              createdAt: serverTimestamp(),
            })
          );
        }
      }

      if (receiveNow && supplierRef && supplierSnapData) {
        tx.update(supplierRef, {
          totalPurchases: roundMoney((supplierSnapData.totalPurchases || 0) + totalAmount),
          outstandingPayable: roundMoney((supplierSnapData.outstandingPayable || 0) + outstandingAmount),
          updatedAt: serverTimestamp(),
        });
      }

      const logId = makeId("log");
      tx.set(doc(db, "businesses", business.id, "audit_logs", logId), {
        id: logId,
        businessId: business.id,
        ownerId: business.ownerId,
        memberUids: business.memberUids,
        action: receiveNow ? "PURCHASE_RECEIVED" : "PURCHASE_CREATED",
        entityType: "PURCHASE",
        entityId: purchaseId,
        summary: clampStr(
          `${receiveNow ? "Received" : "Created"} purchase ${invoiceNumber} from ${supplierName} (${totalAmount})`,
          300
        ),
        actorUid,
        actorName: clampStr(actorName, 120),
        createdAt: serverTimestamp(),
      });
    });

    return purchaseId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function receiveExistingPurchase(params: {
  business: Business;
  actorUid: string;
  actorName: string;
  purchaseId: string;
  purchaseItems: Array<{
    productId: string;
    variantId?: string;
    productName: string;
    quantity: number;
    unitCost: number;
  }>;
}): Promise<void> {
  const { business, actorUid, actorName, purchaseId, purchaseItems } = params;
  const path = `businesses/${business.id}/purchases/${purchaseId}`;

  try {
    await runTransaction(db, async (tx) => {
      const purRef = doc(db, "businesses", business.id, "purchases", purchaseId);
      const purSnap = await tx.get(purRef);
      if (!purSnap.exists()) throw new Error("Purchase not found.");
      const pur = purSnap.data() as Purchase;
      if (pur.stockReceived || pur.status === "RECEIVED") {
        throw new Error("Goods for this purchase have already been received.");
      }

      const targets = new Map<string, { ref: ReturnType<typeof doc>; currentStock: number; purchaseCost: number }>();
      for (const it of purchaseItems) {
        const key = it.variantId ? `v:${it.variantId}` : `p:${it.productId}`;
        if (!targets.has(key)) {
          const ref = it.variantId
            ? doc(db, "businesses", business.id, "product_variants", it.variantId)
            : doc(db, "businesses", business.id, "products", it.productId);
          const snap = await tx.get(ref);
          if (snap.exists()) {
            const d = snap.data() as { currentStock: number; purchaseCost: number };
            targets.set(key, { ref, currentStock: d.currentStock, purchaseCost: d.purchaseCost });
          }
        }
      }

      let supplierSnapData: Supplier | null = null;
      const supplierRef = pur.supplierId ? doc(db, "businesses", business.id, "suppliers", pur.supplierId) : null;
      if (supplierRef) {
        const sSnap = await tx.get(supplierRef);
        if (sSnap.exists()) supplierSnapData = sSnap.data() as Supplier;
      }

      for (const it of purchaseItems) {
        const key = it.variantId ? `v:${it.variantId}` : `p:${it.productId}`;
        const target = targets.get(key);
        if (!target) continue;
        const prev = target.currentStock;
        const next = roundQty(prev + it.quantity);
        const newCost =
          next > 0
            ? roundMoney((Math.max(0, prev) * target.purchaseCost + it.quantity * it.unitCost) / next)
            : roundMoney(it.unitCost);
        target.currentStock = next;
        target.purchaseCost = newCost;
        tx.update(target.ref, {
          currentStock: next,
          purchaseCost: newCost,
          updatedAt: serverTimestamp(),
        });

        const movId = makeId("mov");
        tx.set(
          doc(db, "businesses", business.id, "inventory_movements", movId),
          stripUndefined({
            id: movId,
            businessId: business.id,
            ownerId: business.ownerId,
            memberUids: business.memberUids,
            productId: it.productId,
            variantId: optStr(it.variantId, 128),
            productName: clampStr(it.productName, 160),
            movementType: "PURCHASE_IN" as MovementType,
            quantityDelta: roundQty(it.quantity),
            previousStock: prev,
            newStock: next,
            unitCost: roundMoney(it.unitCost),
            reason: `Goods received from ${pur.supplierName} (${pur.invoiceNumber})`,
            referenceType: "PURCHASE",
            referenceId: purchaseId,
            performedBy: actorUid,
            transactionDate: new Date().toISOString(),
            createdAt: serverTimestamp(),
          })
        );
      }

      tx.update(purRef, {
        status: "RECEIVED",
        stockReceived: true,
        updatedAt: serverTimestamp(),
      });

      if (supplierRef && supplierSnapData) {
        tx.update(supplierRef, {
          totalPurchases: roundMoney((supplierSnapData.totalPurchases || 0) + pur.totalAmount),
          outstandingPayable: roundMoney((supplierSnapData.outstandingPayable || 0) + pur.outstandingAmount),
          updatedAt: serverTimestamp(),
        });
      }

      const logId = makeId("log");
      tx.set(doc(db, "businesses", business.id, "audit_logs", logId), {
        id: logId,
        businessId: business.id,
        ownerId: business.ownerId,
        memberUids: business.memberUids,
        action: "PURCHASE_RECEIVED",
        entityType: "PURCHASE",
        entityId: purchaseId,
        summary: clampStr(`Marked purchase ${pur.invoiceNumber} received and updated stock`, 300),
        actorUid,
        actorName: clampStr(actorName, 120),
        createdAt: serverTimestamp(),
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("already been received")) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function recordPurchasePayment(params: {
  business: Business;
  actorUid: string;
  actorName: string;
  purchaseId: string;
  amount: number;
  paymentMethod: SimplePaymentMethod;
  notes?: string;
}): Promise<void> {
  const { business, actorUid, actorName, purchaseId, amount, paymentMethod, notes } = params;
  const path = `businesses/${business.id}/purchases/${purchaseId}`;

  try {
    await runTransaction(db, async (tx) => {
      const purRef = doc(db, "businesses", business.id, "purchases", purchaseId);
      const purSnap = await tx.get(purRef);
      if (!purSnap.exists()) throw new Error("Purchase not found.");
      const pur = purSnap.data() as Purchase;
      const payAmt = Math.min(pur.outstandingAmount, Math.max(0, roundMoney(amount)));
      if (payAmt <= 0) throw new Error("Payment amount must be greater than zero.");

      let supplierSnapData: Supplier | null = null;
      const supplierRef = pur.supplierId ? doc(db, "businesses", business.id, "suppliers", pur.supplierId) : null;
      if (supplierRef) {
        const sSnap = await tx.get(supplierRef);
        if (sSnap.exists()) supplierSnapData = sSnap.data() as Supplier;
      }

      const newPaid = roundMoney(pur.amountPaid + payAmt);
      const newOut = Math.max(0, roundMoney(pur.totalAmount - newPaid));
      const newPayStatus = newOut <= 0 ? "PAID" : "PARTIAL";

      tx.update(purRef, {
        amountPaid: newPaid,
        outstandingAmount: newOut,
        paymentStatus: newPayStatus,
        updatedAt: serverTimestamp(),
      });

      if (supplierRef && supplierSnapData) {
        tx.update(supplierRef, {
          outstandingPayable: Math.max(0, roundMoney(supplierSnapData.outstandingPayable - payAmt)),
          updatedAt: serverTimestamp(),
        });
      }

      const payId = makeId("pay");
      tx.set(
        doc(db, "businesses", business.id, "payments", payId),
        stripUndefined({
          id: payId,
          businessId: business.id,
          ownerId: business.ownerId,
          memberUids: business.memberUids,
          partyType: "SUPPLIER" as const,
          partyId: pur.supplierId || purchaseId,
          partyName: pur.supplierName,
          amount: payAmt,
          paymentMethod,
          paymentDate: toLocalDateKey(),
          referenceId: purchaseId,
          notes: optStr(notes || `Payment for invoice ${pur.invoiceNumber}`, 240),
          createdAt: serverTimestamp(),
        })
      );

      const logId = makeId("log");
      tx.set(doc(db, "businesses", business.id, "audit_logs", logId), {
        id: logId,
        businessId: business.id,
        ownerId: business.ownerId,
        memberUids: business.memberUids,
        action: "SUPPLIER_PAYMENT",
        entityType: "PURCHASE",
        entityId: purchaseId,
        summary: clampStr(`Paid ${payAmt} toward ${pur.invoiceNumber} (${pur.supplierName})`, 300),
        actorUid,
        actorName: clampStr(actorName, 120),
        createdAt: serverTimestamp(),
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("greater than zero")) throw error;
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveExpense(params: {
  business: Business;
  expenseId?: string;
  data: {
    category: ExpenseCategory;
    description: string;
    amount: number;
    paymentMethod: SimplePaymentMethod;
    expenseDate: string;
    referenceNumber?: string;
    notes?: string;
  };
}): Promise<string> {
  const { business, data } = params;
  const isNew = !params.expenseId;
  const expenseId = params.expenseId || makeId("exp");
  const path = `businesses/${business.id}/expenses/${expenseId}`;

  try {
    if (isNew) {
      await setDoc(
        doc(db, "businesses", business.id, "expenses", expenseId),
        stripUndefined({
          id: expenseId,
          businessId: business.id,
          ownerId: business.ownerId,
          memberUids: business.memberUids,
          category: data.category,
          description: clampStr(data.description, 240),
          amount: Math.max(0.01, roundMoney(data.amount)),
          paymentMethod: data.paymentMethod,
          expenseDate: data.expenseDate,
          referenceNumber: optStr(data.referenceNumber, 80),
          notes: optStr(data.notes, 300),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    } else {
      await updateDoc(
        doc(db, "businesses", business.id, "expenses", expenseId),
        stripUndefined({
          category: data.category,
          description: clampStr(data.description, 240),
          amount: Math.max(0.01, roundMoney(data.amount)),
          paymentMethod: data.paymentMethod,
          expenseDate: data.expenseDate,
          referenceNumber: clampStr(data.referenceNumber, 80),
          notes: clampStr(data.notes, 300),
          updatedAt: serverTimestamp(),
        })
      );
    }
    return expenseId;
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteExpenseRecord(businessId: string, expenseId: string): Promise<void> {
  const path = `businesses/${businessId}/expenses/${expenseId}`;
  try {
    await deleteDoc(doc(db, "businesses", businessId, "expenses", expenseId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveCustomer(params: {
  business: Business;
  customerId?: string;
  data: { name: string; phone?: string; email?: string; address?: string };
}): Promise<string> {
  const { business, data } = params;
  const isNew = !params.customerId;
  const customerId = params.customerId || makeId("cus");
  const path = `businesses/${business.id}/customers/${customerId}`;
  try {
    if (isNew) {
      await setDoc(
        doc(db, "businesses", business.id, "customers", customerId),
        stripUndefined({
          id: customerId,
          businessId: business.id,
          ownerId: business.ownerId,
          memberUids: business.memberUids,
          name: clampStr(data.name, 120),
          phone: optStr(data.phone, 30),
          email: optStr(data.email, 200),
          address: optStr(data.address, 300),
          totalPurchases: 0,
          outstandingCredit: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    } else {
      await updateDoc(
        doc(db, "businesses", business.id, "customers", customerId),
        stripUndefined({
          name: clampStr(data.name, 120),
          phone: clampStr(data.phone, 30),
          email: clampStr(data.email, 200),
          address: clampStr(data.address, 300),
          updatedAt: serverTimestamp(),
        })
      );
    }
    return customerId;
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function saveSupplier(params: {
  business: Business;
  supplierId?: string;
  data: { name: string; contactPerson?: string; phone?: string; email?: string; address?: string };
}): Promise<string> {
  const { business, data } = params;
  const isNew = !params.supplierId;
  const supplierId = params.supplierId || makeId("sup");
  const path = `businesses/${business.id}/suppliers/${supplierId}`;
  try {
    if (isNew) {
      await setDoc(
        doc(db, "businesses", business.id, "suppliers", supplierId),
        stripUndefined({
          id: supplierId,
          businessId: business.id,
          ownerId: business.ownerId,
          memberUids: business.memberUids,
          name: clampStr(data.name, 120),
          contactPerson: optStr(data.contactPerson, 120),
          phone: optStr(data.phone, 30),
          email: optStr(data.email, 200),
          address: optStr(data.address, 300),
          totalPurchases: 0,
          outstandingPayable: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    } else {
      await updateDoc(
        doc(db, "businesses", business.id, "suppliers", supplierId),
        stripUndefined({
          name: clampStr(data.name, 120),
          contactPerson: clampStr(data.contactPerson, 120),
          phone: clampStr(data.phone, 30),
          email: clampStr(data.email, 200),
          address: clampStr(data.address, 300),
          updatedAt: serverTimestamp(),
        })
      );
    }
    return supplierId;
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function recordCustomerCreditPayment(params: {
  business: Business;
  actorUid: string;
  actorName: string;
  customerId: string;
  amount: number;
  paymentMethod: SimplePaymentMethod;
  notes?: string;
}): Promise<void> {
  const { business, actorUid, actorName, customerId, amount, paymentMethod, notes } = params;
  const path = `businesses/${business.id}/customers/${customerId}`;
  try {
    await runTransaction(db, async (tx) => {
      const cRef = doc(db, "businesses", business.id, "customers", customerId);
      const cSnap = await tx.get(cRef);
      if (!cSnap.exists()) throw new Error("Customer not found.");
      const c = cSnap.data() as Customer;
      const payAmt = Math.min(c.outstandingCredit, Math.max(0, roundMoney(amount)));
      if (payAmt <= 0) throw new Error("Payment amount must be greater than zero.");

      tx.update(cRef, {
        outstandingCredit: Math.max(0, roundMoney(c.outstandingCredit - payAmt)),
        updatedAt: serverTimestamp(),
      });

      const payId = makeId("pay");
      tx.set(
        doc(db, "businesses", business.id, "payments", payId),
        stripUndefined({
          id: payId,
          businessId: business.id,
          ownerId: business.ownerId,
          memberUids: business.memberUids,
          partyType: "CUSTOMER" as const,
          partyId: customerId,
          partyName: c.name,
          amount: payAmt,
          paymentMethod,
          paymentDate: toLocalDateKey(),
          referenceId: customerId,
          notes: optStr(notes || `Credit repayment from ${c.name}`, 240),
          createdAt: serverTimestamp(),
        })
      );

      const logId = makeId("log");
      tx.set(doc(db, "businesses", business.id, "audit_logs", logId), {
        id: logId,
        businessId: business.id,
        ownerId: business.ownerId,
        memberUids: business.memberUids,
        action: "CUSTOMER_PAYMENT",
        entityType: "CUSTOMER",
        entityId: customerId,
        summary: clampStr(`Received ${payAmt} credit payment from ${c.name}`, 300),
        actorUid,
        actorName: clampStr(actorName, 120),
        createdAt: serverTimestamp(),
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("greater than zero")) throw error;
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function recordSupplierDirectPayment(params: {
  business: Business;
  actorUid: string;
  actorName: string;
  supplierId: string;
  amount: number;
  paymentMethod: SimplePaymentMethod;
  notes?: string;
}): Promise<void> {
  const { business, actorUid, actorName, supplierId, amount, paymentMethod, notes } = params;
  const path = `businesses/${business.id}/suppliers/${supplierId}`;
  try {
    await runTransaction(db, async (tx) => {
      const sRef = doc(db, "businesses", business.id, "suppliers", supplierId);
      const sSnap = await tx.get(sRef);
      if (!sSnap.exists()) throw new Error("Supplier not found.");
      const s = sSnap.data() as Supplier;
      const payAmt = Math.min(s.outstandingPayable, Math.max(0, roundMoney(amount)));
      if (payAmt <= 0) throw new Error("Payment amount must be greater than zero.");

      tx.update(sRef, {
        outstandingPayable: Math.max(0, roundMoney(s.outstandingPayable - payAmt)),
        updatedAt: serverTimestamp(),
      });

      const payId = makeId("pay");
      tx.set(
        doc(db, "businesses", business.id, "payments", payId),
        stripUndefined({
          id: payId,
          businessId: business.id,
          ownerId: business.ownerId,
          memberUids: business.memberUids,
          partyType: "SUPPLIER" as const,
          partyId: supplierId,
          partyName: s.name,
          amount: payAmt,
          paymentMethod,
          paymentDate: toLocalDateKey(),
          referenceId: supplierId,
          notes: optStr(notes || `Payment to ${s.name}`, 240),
          createdAt: serverTimestamp(),
        })
      );

      const logId = makeId("log");
      tx.set(doc(db, "businesses", business.id, "audit_logs", logId), {
        id: logId,
        businessId: business.id,
        ownerId: business.ownerId,
        memberUids: business.memberUids,
        action: "SUPPLIER_PAYMENT",
        entityType: "SUPPLIER",
        entityId: supplierId,
        summary: clampStr(`Paid ${payAmt} to supplier ${s.name}`, 300),
        actorUid,
        actorName: clampStr(actorName, 120),
        createdAt: serverTimestamp(),
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("greater than zero")) throw error;
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
