export type LanguageCode = "en" | "ta";

export type BusinessCategory =
  | "Grocery"
  | "Clothing"
  | "Stationery"
  | "Electronics"
  | "Hardware"
  | "General retail"
  | "Other";

export type BusinessRole = "OWNER" | "MANAGER" | "CASHIER";

export type DateFormatOption = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";

export type ProductUnit = "pcs" | "kg" | "g" | "L" | "mL" | "pack" | "box" | "m" | "dozen";

export type PaymentMethod = "CASH" | "UPI" | "CARD" | "BANK_TRANSFER" | "CREDIT" | "SPLIT";

export type SimplePaymentMethod = "CASH" | "UPI" | "CARD" | "BANK_TRANSFER";

export type SaleStatus = "COMPLETED" | "PARTIALLY_RETURNED" | "RETURNED" | "CANCELLED";

export type PurchaseStatus = "DRAFT" | "ORDERED" | "RECEIVED" | "CANCELLED";

export type PaymentStatus = "UNPAID" | "PARTIAL" | "PAID";

export type MovementType =
  | "OPENING_STOCK"
  | "PURCHASE_IN"
  | "SALE_OUT"
  | "CUSTOMER_RETURN_IN"
  | "SALE_CANCEL_REVERSAL"
  | "DAMAGED_OUT"
  | "EXPIRED_OUT"
  | "ADJUSTMENT_IN"
  | "ADJUSTMENT_OUT"
  | "RECONCILIATION";

export type ExpenseCategory =
  | "Rent"
  | "Electricity"
  | "Employee wages"
  | "Transportation"
  | "Packaging"
  | "Maintenance"
  | "Internet and telephone"
  | "Marketing"
  | "Other expenses";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  preferredLanguage: LanguageCode;
  activeBusinessId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Business {
  id: string;
  ownerId: string;
  memberUids: string[];
  memberRoles: Record<string, BusinessRole>;
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
  taxEnabled?: boolean;
  defaultTaxRate?: number;
  receiptFooter?: string;
  lowStockAlertsEnabled?: boolean;
  dailySummaryAlertsEnabled?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Product {
  id: string;
  businessId: string;
  ownerId: string;
  memberUids: string[];
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
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ProductVariant {
  id: string;
  businessId: string;
  ownerId: string;
  memberUids: string[];
  productId: string;
  variantName: string;
  sku: string;
  purchaseCost: number;
  sellingPrice: number;
  currentStock: number;
  minStockLevel: number;
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface InventoryMovement {
  id: string;
  businessId: string;
  ownerId: string;
  memberUids: string[];
  productId: string;
  variantId?: string;
  productName: string;
  movementType: MovementType;
  quantityDelta: number;
  previousStock: number;
  newStock: number;
  unitCost?: number;
  reason: string;
  referenceType: "SALE" | "PURCHASE" | "RETURN" | "ADJUSTMENT" | "PRODUCT_INIT";
  referenceId: string;
  performedBy: string;
  transactionDate: string;
  createdAt?: unknown;
}

export interface PaymentBreakdown {
  cash: number;
  upi: number;
  card: number;
  bankTransfer: number;
  credit: number;
}

export interface Sale {
  id: string;
  businessId: string;
  ownerId: string;
  memberUids: string[];
  receiptNumber: string;
  transactionDate: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  totalCost: number;
  paidAmount: number;
  creditAmount: number;
  refundedAmount: number;
  paymentMethod: PaymentMethod;
  paymentBreakdown?: PaymentBreakdown;
  customerId?: string;
  customerName?: string;
  staffUid: string;
  staffName?: string;
  status: SaleStatus;
  itemCount: number;
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SaleItem {
  id: string;
  businessId: string;
  ownerId: string;
  memberUids: string[];
  saleId: string;
  productId: string;
  variantId?: string;
  productName: string;
  unit: string;
  quantity: number;
  returnedQuantity: number;
  unitPrice: number;
  unitCostSnapshot: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
  transactionDate: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Purchase {
  id: string;
  businessId: string;
  ownerId: string;
  memberUids: string[];
  supplierId?: string;
  supplierName: string;
  invoiceNumber: string;
  purchaseDate: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  outstandingAmount: number;
  paymentStatus: PaymentStatus;
  status: PurchaseStatus;
  stockReceived: boolean;
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PurchaseItem {
  id: string;
  businessId: string;
  ownerId: string;
  memberUids: string[];
  purchaseId: string;
  productId: string;
  variantId?: string;
  productName: string;
  unit: string;
  quantity: number;
  unitCost: number;
  taxAmount: number;
  lineTotal: number;
  createdAt?: unknown;
}

export interface Expense {
  id: string;
  businessId: string;
  ownerId: string;
  memberUids: string[];
  category: ExpenseCategory;
  description: string;
  amount: number;
  paymentMethod: SimplePaymentMethod;
  expenseDate: string;
  referenceNumber?: string;
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Customer {
  id: string;
  businessId: string;
  ownerId: string;
  memberUids: string[];
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  totalPurchases: number;
  outstandingCredit: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Supplier {
  id: string;
  businessId: string;
  ownerId: string;
  memberUids: string[];
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  totalPurchases: number;
  outstandingPayable: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Payment {
  id: string;
  businessId: string;
  ownerId: string;
  memberUids: string[];
  partyType: "CUSTOMER" | "SUPPLIER";
  partyId: string;
  partyName: string;
  amount: number;
  paymentMethod: SimplePaymentMethod;
  paymentDate: string;
  referenceId?: string;
  notes?: string;
  createdAt?: unknown;
}

export interface NotificationRecord {
  id: string;
  businessId: string;
  ownerId: string;
  memberUids: string[];
  alertKey: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "error";
  isRead: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AuditLog {
  id: string;
  businessId: string;
  ownerId: string;
  memberUids: string[];
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  actorUid: string;
  actorName: string;
  createdAt?: unknown;
}

export interface CartLineItem {
  productId: string;
  variantId?: string;
  productName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  unitCostSnapshot: number;
  taxRate: number;
  maxAvailableStock: number;
}

export interface PendingOfflineSale {
  idempotencyKey: string;
  businessId: string;
  createdAtIso: string;
  transactionDate: string;
  items: CartLineItem[];
  discountAmount: number;
  paymentMethod: PaymentMethod;
  paymentBreakdown: PaymentBreakdown;
  customerId?: string;
  customerName?: string;
  notes?: string;
  totalAmount: number;
  syncError?: string;
}

export const BUSINESS_CATEGORIES: BusinessCategory[] = [
  "Grocery",
  "Clothing",
  "Stationery",
  "Electronics",
  "Hardware",
  "General retail",
  "Other",
];

export const PRODUCT_UNITS: ProductUnit[] = [
  "pcs",
  "kg",
  "g",
  "L",
  "mL",
  "pack",
  "box",
  "m",
  "dozen",
];

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Rent",
  "Electricity",
  "Employee wages",
  "Transportation",
  "Packaging",
  "Maintenance",
  "Internet and telephone",
  "Marketing",
  "Other expenses",
];

export const CURRENCY_OPTIONS = [
  { code: "INR", symbol: "₹", label: "Indian Rupee (₹)" },
  { code: "USD", symbol: "$", label: "US Dollar ($)" },
  { code: "EUR", symbol: "€", label: "Euro (€)" },
  { code: "GBP", symbol: "£", label: "British Pound (£)" },
  { code: "AED", symbol: "AED", label: "UAE Dirham (AED)" },
  { code: "SGD", symbol: "S$", label: "Singapore Dollar (S$)" },
  { code: "MYR", symbol: "RM", label: "Malaysian Ringgit (RM)" },
];
