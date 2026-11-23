import type { PendingOfflineSale, Product } from "../types/retail";

const PRODUCT_CACHE_PREFIX = "retailmate_products_cache_";
const OFFLINE_SALES_PREFIX = "retailmate_offline_sales_";

export function cacheProductsLocally(businessId: string, products: Product[]): void {
  try {
    localStorage.setItem(`${PRODUCT_CACHE_PREFIX}${businessId}`, JSON.stringify(products));
  } catch {
    // Ignore storage quota issues
  }
}

export function getCachedProducts(businessId: string): Product[] {
  try {
    const raw = localStorage.getItem(`${PRODUCT_CACHE_PREFIX}${businessId}`);
    if (!raw) return [];
    return JSON.parse(raw) as Product[];
  } catch {
    return [];
  }
}

export function getPendingOfflineSales(businessId: string): PendingOfflineSale[] {
  try {
    const raw = localStorage.getItem(`${OFFLINE_SALES_PREFIX}${businessId}`);
    if (!raw) return [];
    return JSON.parse(raw) as PendingOfflineSale[];
  } catch {
    return [];
  }
}

export function enqueueOfflineSale(businessId: string, sale: PendingOfflineSale): PendingOfflineSale[] {
  const existing = getPendingOfflineSales(businessId);
  if (existing.some((s) => s.idempotencyKey === sale.idempotencyKey)) {
    return existing;
  }
  const updated = [sale, ...existing];
  try {
    localStorage.setItem(`${OFFLINE_SALES_PREFIX}${businessId}`, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
  return updated;
}

export function removeOfflineSale(businessId: string, idempotencyKey: string): PendingOfflineSale[] {
  const updated = getPendingOfflineSales(businessId).filter((s) => s.idempotencyKey !== idempotencyKey);
  try {
    localStorage.setItem(`${OFFLINE_SALES_PREFIX}${businessId}`, JSON.stringify(updated));
  } catch {
    // Ignore
  }
  return updated;
}

export function updateOfflineSaleError(
  businessId: string,
  idempotencyKey: string,
  syncError: string
): PendingOfflineSale[] {
  const updated = getPendingOfflineSales(businessId).map((s) =>
    s.idempotencyKey === idempotencyKey ? { ...s, syncError } : s
  );
  try {
    localStorage.setItem(`${OFFLINE_SALES_PREFIX}${businessId}`, JSON.stringify(updated));
  } catch {
    // Ignore
  }
  return updated;
}
