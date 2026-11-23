import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpDown,
  Download,
  Edit3,
  Eye,
  History,
  Layers,
  Package,
  Plus,
  Search,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import { useStore } from "../context/StoreContext";
import {
  formatCurrency,
  formatDateDisplay,
  roundMoney,
  roundQty,
  sanitizeDecimalInput,
} from "../lib/finance";
import { adjustStock, makeId, saveProduct, saveProductVariant } from "../lib/storeService";
import { PRODUCT_UNITS, type Product, type ProductUnit, type ProductVariant } from "../types/retail";
import {
  Button,
  EmptyState,
  FieldLabel,
  Modal,
  SelectInput,
  TextInput,
} from "../components/ui/Primitives";

export function ProductsPage() {
  const {
    user,
    userProfile,
    activeBusiness,
    userRole,
    isSampleMode,
    products,
    variants,
    movements,
    saleItems,
    purchaseItems,
    suppliers,
    showToast,
    updateSampleBundle,
    sampleAdjustStock,
  } = useStore();

  const [viewMode, setViewMode] = useState<"catalog" | "lowStock" | "movements">("catalog");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"name" | "stock" | "price">("name");

  // Modals
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<{ product: Product; variant?: ProductVariant } | null>(null);
  const [variantModalProduct, setVariantModalProduct] = useState<Product | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const currency = activeBusiness?.currency || "INR";
  const canEdit = userRole === "OWNER" || userRole === "MANAGER";

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean));
    return ["ALL", ...Array.from(set).sort()];
  }, [products]);

  const variantsByProduct = useMemo(() => {
    const map = new Map<string, ProductVariant[]>();
    for (const v of variants) {
      const list = map.get(v.productId) || [];
      list.push(v);
      map.set(v.productId, list);
    }
    return map;
  }, [variants]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => {
        if (categoryFilter !== "ALL" && p.category !== categoryFilter) return false;
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode || "").toLowerCase().includes(q) ||
          (p.brand || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === "stock") return a.currentStock - b.currentStock;
        if (sortBy === "price") return b.sellingPrice - a.sellingPrice;
        return a.name.localeCompare(b.name);
      });
  }, [products, search, categoryFilter, sortBy]);

  const lowStockList = useMemo(() => {
    const rows: Array<{
      id: string;
      product: Product;
      variant?: ProductVariant;
      label: string;
      stock: number;
      minLevel: number;
    }> = [];
    for (const p of products.filter((x) => x.isActive)) {
      const pVars = variantsByProduct.get(p.id) || [];
      if (p.hasVariants && pVars.length > 0) {
        for (const v of pVars) {
          if (v.currentStock <= v.minStockLevel) {
            rows.push({
              id: v.id,
              product: p,
              variant: v,
              label: `${p.name} (${v.variantName})`,
              stock: v.currentStock,
              minLevel: v.minStockLevel,
            });
          }
        }
      } else if (p.currentStock <= p.minStockLevel) {
        rows.push({
          id: p.id,
          product: p,
          label: p.name,
          stock: p.currentStock,
          minLevel: p.minStockLevel,
        });
      }
    }
    return rows.sort((a, b) => a.stock - b.stock);
  }, [products, variantsByProduct]);

  const totalInventoryValue = useMemo(() => {
    let val = 0;
    for (const p of products.filter((x) => x.isActive)) {
      const pVars = variantsByProduct.get(p.id) || [];
      if (p.hasVariants && pVars.length > 0) {
        val += pVars.reduce((s, v) => s + v.currentStock * v.purchaseCost, 0);
      } else {
        val += p.currentStock * p.purchaseCost;
      }
    }
    return roundMoney(val);
  }, [products, variantsByProduct]);

  const handleExportCsv = () => {
    const headers = [
      "Name",
      "SKU",
      "Barcode",
      "Category",
      "Brand",
      "Unit",
      "PurchaseCost",
      "SellingPrice",
      "CurrentStock",
      "MinStockLevel",
      "TaxRate",
      "ExpiryDate",
      "Active",
    ];
    const rows = products.map((p) =>
      [
        `"${p.name.replace(/"/g, '""')}"`,
        p.sku,
        p.barcode || "",
        `"${p.category.replace(/"/g, '""')}"`,
        `"${(p.brand || "").replace(/"/g, '""')}"`,
        p.unit,
        p.purchaseCost,
        p.sellingPrice,
        p.currentStock,
        p.minStockLevel,
        p.taxRate,
        p.expiryDate || "",
        p.isActive ? "Yes" : "No",
      ].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeBusiness?.name.replace(/\s+/g, "_") || "products"}_inventory.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Header & Summary Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#17263C]">Products & Inventory</h2>
          <p className="text-xs text-[#758195] mt-0.5">
            {products.filter((p) => p.isActive).length} active items · Inventory cost value{" "}
            <span className="font-mono-num font-semibold text-[#17263C]">
              {formatCurrency(totalInventoryValue, currency)}
            </span>{" "}
            · {lowStockList.length} low/out of stock
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleExportCsv} disabled={products.length === 0}>
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          {canEdit && (
            <>
              <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>
                <Upload className="w-4 h-4" />
                Import CSV
              </Button>
              <Button
                variant="accent"
                size="sm"
                onClick={() => {
                  setEditingProduct(null);
                  setProductModalOpen(true);
                }}
              >
                <Plus className="w-4 h-4" />
                Add Product
              </Button>
            </>
          )}
        </div>
      </div>

      {/* View Switch Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-white border border-[#E6EAE9] rounded-lg">
          <button
            type="button"
            onClick={() => setViewMode("catalog")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
              viewMode === "catalog" ? "bg-[#17263C] text-white" : "text-[#758195] hover:text-[#17263C]"
            }`}
          >
            All Products ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode("lowStock")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
              viewMode === "lowStock" ? "bg-[#17263C] text-white" : "text-[#758195] hover:text-[#17263C]"
            }`}
          >
            Low / Out of Stock ({lowStockList.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode("movements")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
              viewMode === "movements" ? "bg-[#17263C] text-white" : "text-[#758195] hover:text-[#17263C]"
            }`}
          >
            Stock Ledger ({movements.length})
          </button>
        </div>

        {viewMode === "catalog" && (
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-[#758195] absolute left-3 top-1/2 -translate-y-1/2" />
              <TextInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, SKU, barcode..."
                className="pl-9 !min-h-[38px] text-xs"
              />
            </div>
            <SelectInput
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="!w-auto !min-h-[38px] text-xs"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === "ALL" ? "All Categories" : c}
                </option>
              ))}
            </SelectInput>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setSortBy((s) => (s === "name" ? "stock" : s === "stock" ? "price" : "name"))
              }
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              Sort: {sortBy === "name" ? "Name" : sortBy === "stock" ? "Stock" : "Price"}
            </Button>
          </div>
        )}
      </div>

      {/* Catalog View */}
      {viewMode === "catalog" && (
        <>
          {filteredProducts.length === 0 ? (
            <EmptyState
              icon={<Package className="w-5 h-5" />}
              title={products.length === 0 ? "No products added yet" : "No matching products"}
              description={
                products.length === 0
                  ? "Add your first product with opening stock, cost, and selling price to start billing."
                  : "Try adjusting your search or category filter."
              }
              action={
                canEdit && products.length === 0 ? (
                  <Button
                    variant="accent"
                    onClick={() => {
                      setEditingProduct(null);
                      setProductModalOpen(true);
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    Add First Product
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="bg-white border border-[#E6EAE9] rounded-xl overflow-hidden">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E6EAE9] bg-[#F7F8F6] text-[11px] font-semibold text-[#758195]">
                      <th className="py-3 px-4">Product</th>
                      <th className="py-3 px-3">Category</th>
                      <th className="py-3 px-3 text-right">Cost</th>
                      <th className="py-3 px-3 text-right">Selling Price</th>
                      <th className="py-3 px-3 text-right">Margin</th>
                      <th className="py-3 px-3 text-right">Stock</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6EAE9] text-xs">
                    {filteredProducts.map((p) => {
                      const pVars = variantsByProduct.get(p.id) || [];
                      const displayStock =
                        p.hasVariants && pVars.length > 0
                          ? pVars.reduce((s, v) => s + v.currentStock, 0)
                          : p.currentStock;
                      const isLow = displayStock <= p.minStockLevel;
                      const marginPct =
                        p.sellingPrice > 0
                          ? Math.round(((p.sellingPrice - p.purchaseCost) / p.sellingPrice) * 100)
                          : 0;

                      return (
                        <tr key={p.id} className="hover:bg-[#F7F8F6]/60 transition-colors">
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={() => setDetailProduct(p)}
                              className="text-left group cursor-pointer"
                            >
                              <p className="font-semibold text-[#17263C] group-hover:text-[#147D75]">
                                {p.name}
                                {!p.isActive && (
                                  <span className="ml-2 text-[11px] text-[#758195]">(Archived)</span>
                                )}
                              </p>
                              <p className="text-[11px] text-[#758195] font-mono-num">
                                {p.sku}
                                {p.hasVariants ? ` · ${pVars.length} variant(s)` : ""}
                              </p>
                            </button>
                          </td>
                          <td className="py-3 px-3 text-[#758195]">{p.category}</td>
                          <td className="py-3 px-3 text-right font-mono-num text-[#758195]">
                            {formatCurrency(p.purchaseCost, currency)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono-num font-semibold text-[#17263C]">
                            {formatCurrency(p.sellingPrice, currency)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono-num text-[#21865B]">
                            {marginPct}%
                          </td>
                          <td className="py-3 px-3 text-right font-mono-num">
                            <span
                              className={`font-semibold ${
                                displayStock <= 0
                                  ? "text-[#C84C4C]"
                                  : isLow
                                  ? "text-[#D99A31]"
                                  : "text-[#17263C]"
                              }`}
                            >
                              {displayStock} {p.unit}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setDetailProduct(p)}
                                title="View product details"
                                className="p-2 rounded-lg text-[#758195] hover:bg-[#F7F8F6] hover:text-[#17263C] cursor-pointer"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {canEdit && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setAdjustTarget({ product: p })}
                                    title="Adjust or reconcile stock"
                                    className="p-2 rounded-lg text-[#758195] hover:bg-[#F7F8F6] hover:text-[#147D75] cursor-pointer"
                                  >
                                    <SlidersHorizontal className="w-4 h-4" />
                                  </button>
                                  {p.hasVariants && (
                                    <button
                                      type="button"
                                      onClick={() => setVariantModalProduct(p)}
                                      title="Manage variants"
                                      className="p-2 rounded-lg text-[#758195] hover:bg-[#F7F8F6] hover:text-[#17263C] cursor-pointer"
                                    >
                                      <Layers className="w-4 h-4" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingProduct(p);
                                      setProductModalOpen(true);
                                    }}
                                    title="Edit product"
                                    className="p-2 rounded-lg text-[#758195] hover:bg-[#F7F8F6] hover:text-[#17263C] cursor-pointer"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List */}
              <div className="md:hidden divide-y divide-[#E6EAE9]">
                {filteredProducts.map((p) => {
                  const pVars = variantsByProduct.get(p.id) || [];
                  const displayStock =
                    p.hasVariants && pVars.length > 0
                      ? pVars.reduce((s, v) => s + v.currentStock, 0)
                      : p.currentStock;
                  return (
                    <div key={p.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setDetailProduct(p)}
                          className="text-left min-w-0"
                        >
                          <p className="text-sm font-semibold text-[#17263C] truncate">{p.name}</p>
                          <p className="text-xs text-[#758195]">
                            {p.category} · <span className="font-mono-num">{p.sku}</span>
                          </p>
                        </button>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-mono-num font-bold text-[#17263C]">
                            {formatCurrency(p.sellingPrice, currency)}
                          </p>
                          <p
                            className={`text-xs font-mono-num font-medium ${
                              displayStock <= 0
                                ? "text-[#C84C4C]"
                                : displayStock <= p.minStockLevel
                                ? "text-[#D99A31]"
                                : "text-[#21865B]"
                            }`}
                          >
                            {displayStock} {p.unit} in stock
                          </p>
                        </div>
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setAdjustTarget({ product: p })}
                          >
                            Adjust Stock
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setEditingProduct(p);
                              setProductModalOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Low Stock View */}
      {viewMode === "lowStock" && (
        <div className="bg-white border border-[#E6EAE9] rounded-xl overflow-hidden">
          {lowStockList.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#758195]">
              All active products are comfortably above their minimum stock thresholds.
            </div>
          ) : (
            <div className="divide-y divide-[#E6EAE9]">
              {lowStockList.map((row) => (
                <div key={row.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <AlertTriangle
                        className={`w-4 h-4 ${row.stock <= 0 ? "text-[#C84C4C]" : "text-[#D99A31]"}`}
                      />
                      <p className="text-sm font-semibold text-[#17263C]">{row.label}</p>
                    </div>
                    <p className="text-xs text-[#758195] mt-1">
                      Current: <span className="font-mono-num font-semibold">{row.stock} {row.product.unit}</span> · Minimum:{" "}
                      <span className="font-mono-num">{row.minLevel} {row.product.unit}</span>
                      {row.product.supplierName ? ` · Supplier: ${row.product.supplierName}` : ""}
                    </p>
                  </div>
                  {canEdit && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setAdjustTarget({ product: row.product, variant: row.variant })}
                    >
                      Restock / Adjust
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Inventory Movement Ledger */}
      {viewMode === "movements" && (
        <div className="bg-white border border-[#E6EAE9] rounded-xl overflow-hidden">
          {movements.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#758195]">
              Every purchase, sale, return, and stock adjustment will appear in this audit ledger.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E6EAE9] bg-[#F7F8F6] text-[11px] font-semibold text-[#758195]">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-3">Product</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3 text-right">Change</th>
                    <th className="py-3 px-3 text-right">Balance</th>
                    <th className="py-3 px-4">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6EAE9] text-xs">
                  {[...movements]
                    .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))
                    .slice(0, 100)
                    .map((m) => (
                      <tr key={m.id}>
                        <td className="py-2.5 px-4 font-mono-num text-[#758195] whitespace-nowrap">
                          {formatDateDisplay(m.transactionDate, activeBusiness?.dateFormat)}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-[#17263C]">{m.productName}</td>
                        <td className="py-2.5 px-3 text-[#758195]">{m.movementType.replace(/_/g, " ")}</td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono-num font-semibold ${
                            m.quantityDelta >= 0 ? "text-[#21865B]" : "text-[#C84C4C]"
                          }`}
                        >
                          {m.quantityDelta >= 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-num text-[#17263C]">
                          {m.newStock}
                        </td>
                        <td className="py-2.5 px-4 text-[#758195]">{m.reason}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {productModalOpen && activeBusiness && (
        <ProductFormModal
          open={productModalOpen}
          onClose={() => setProductModalOpen(false)}
          product={editingProduct}
          suppliers={suppliers}
          currency={currency}
          defaultTaxRate={activeBusiness.taxEnabled ? activeBusiness.defaultTaxRate || 0 : 0}
          onSave={async (data) => {
            if (isSampleMode) {
              updateSampleBundle((prev) => {
                const isNew = !editingProduct;
                const prodId = editingProduct?.id || makeId("prd");
                const nextProd: Product = {
                  id: prodId,
                  businessId: prev.business.id,
                  ownerId: prev.business.ownerId,
                  memberUids: prev.business.memberUids,
                  ...data,
                  currentStock: isNew ? data.currentStock : editingProduct!.currentStock,
                };
                return {
                  ...prev,
                  products: isNew
                    ? [nextProd, ...prev.products]
                    : prev.products.map((p) => (p.id === prodId ? nextProd : p)),
                };
              });
              showToast(editingProduct ? "Product updated." : "Product added to sample store.");
              setProductModalOpen(false);
              return;
            }
            if (!user) return;
            await saveProduct({
              business: activeBusiness,
              actorUid: user.uid,
              actorName: userProfile?.displayName || user.displayName || "Owner",
              productId: editingProduct?.id,
              data,
            });
            showToast(editingProduct ? "Product updated." : "Product created.");
            setProductModalOpen(false);
          }}
        />
      )}

      {/* Adjust / Reconcile Stock Modal */}
      {adjustTarget && activeBusiness && (
        <StockAdjustModal
          open={Boolean(adjustTarget)}
          onClose={() => setAdjustTarget(null)}
          target={adjustTarget}
          onConfirm={async (movementType, qty, reason) => {
            if (isSampleMode) {
              sampleAdjustStock({
                productId: adjustTarget.product.id,
                variantId: adjustTarget.variant?.id,
                movementType,
                quantityOrCountedStock: qty,
                reason,
              });
              showToast("Stock updated in sample ledger.");
              setAdjustTarget(null);
              return;
            }
            if (!user) return;
            await adjustStock({
              business: activeBusiness,
              actorUid: user.uid,
              actorName: userProfile?.displayName || user.displayName || "Owner",
              productId: adjustTarget.product.id,
              variantId: adjustTarget.variant?.id,
              movementType,
              quantityOrCountedStock: qty,
              reason,
            });
            showToast("Inventory adjusted and logged.");
            setAdjustTarget(null);
          }}
        />
      )}

      {/* Manage Variants Modal */}
      {variantModalProduct && activeBusiness && (
        <VariantManagerModal
          open={Boolean(variantModalProduct)}
          onClose={() => setVariantModalProduct(null)}
          product={variantModalProduct}
          variants={variantsByProduct.get(variantModalProduct.id) || []}
          currency={currency}
          onAddVariant={async (vData) => {
            if (isSampleMode) {
              updateSampleBundle((prev) => ({
                ...prev,
                variants: [
                  ...prev.variants,
                  {
                    id: makeId("var"),
                    businessId: prev.business.id,
                    ownerId: prev.business.ownerId,
                    memberUids: prev.business.memberUids,
                    productId: variantModalProduct.id,
                    ...vData,
                  },
                ],
              }));
              showToast("Variant added.");
              return;
            }
            if (!user) return;
            await saveProductVariant({
              business: activeBusiness,
              actorUid: user.uid,
              product: variantModalProduct,
              data: vData,
            });
            showToast("Product variation saved.");
          }}
          onAdjustVariant={(variant) => {
            setVariantModalProduct(null);
            setAdjustTarget({ product: variantModalProduct, variant });
          }}
        />
      )}

      {/* Product Detail Drawer/Modal */}
      {detailProduct && (
        <ProductDetailModal
          product={detailProduct}
          variants={variantsByProduct.get(detailProduct.id) || []}
          movements={movements.filter((m) => m.productId === detailProduct.id)}
          saleItems={saleItems.filter((s) => s.productId === detailProduct.id)}
          purchaseItems={purchaseItems.filter((p) => p.productId === detailProduct.id)}
          currency={currency}
          dateFormat={activeBusiness?.dateFormat}
          onClose={() => setDetailProduct(null)}
        />
      )}

      {/* CSV Import Modal */}
      {importOpen && activeBusiness && (
        <CsvImportModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onImport={async (rows) => {
            if (isSampleMode) {
              updateSampleBundle((prev) => ({
                ...prev,
                products: [
                  ...rows.map((r) => ({
                    id: makeId("prd"),
                    businessId: prev.business.id,
                    ownerId: prev.business.ownerId,
                    memberUids: prev.business.memberUids,
                    ...r,
                    hasVariants: false,
                    isActive: true,
                  })),
                  ...prev.products,
                ],
              }));
              showToast(`Imported ${rows.length} product(s).`);
              setImportOpen(false);
              return;
            }
            if (!user) return;
            for (const r of rows) {
              await saveProduct({
                business: activeBusiness,
                actorUid: user.uid,
                actorName: userProfile?.displayName || user.displayName || "Owner",
                data: { ...r, hasVariants: false, isActive: true },
              });
            }
            showToast(`Imported ${rows.length} product(s) successfully.`);
            setImportOpen(false);
          }}
        />
      )}
    </div>
  );
}

function ProductFormModal({
  open,
  onClose,
  product,
  suppliers,
  currency,
  defaultTaxRate,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  product: Product | null;
  suppliers: Array<{ id: string; name: string }>;
  currency: string;
  defaultTaxRate: number;
  onSave: (data: {
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
  }) => Promise<void>;
}) {
  const [name, setName] = useState(product?.name || "");
  const [sku, setSku] = useState(product?.sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`);
  const [barcode, setBarcode] = useState(product?.barcode || "");
  const [category, setCategory] = useState(product?.category || "General");
  const [brand, setBrand] = useState(product?.brand || "");
  const [description, setDescription] = useState(product?.description || "");
  const [unit, setUnit] = useState<ProductUnit>(product?.unit || "pcs");
  const [purchaseCost, setPurchaseCost] = useState(String(product?.purchaseCost ?? ""));
  const [sellingPrice, setSellingPrice] = useState(String(product?.sellingPrice ?? ""));
  const [currentStock, setCurrentStock] = useState(String(product?.currentStock ?? "0"));
  const [minStockLevel, setMinStockLevel] = useState(String(product?.minStockLevel ?? "5"));
  const [supplierId, setSupplierId] = useState(product?.supplierId || "");
  const [taxRate, setTaxRate] = useState(String(product?.taxRate ?? defaultTaxRate));
  const [expiryDate, setExpiryDate] = useState(product?.expiryDate || "");
  const [hasVariants, setHasVariants] = useState(product?.hasVariants || false);
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !sku.trim()) {
      setErr("Product name and SKU are required.");
      return;
    }
    const costNum = purchaseCost.trim() === "" ? NaN : Number(purchaseCost);
    const priceNum = sellingPrice.trim() === "" ? NaN : Number(sellingPrice);
    const stockNum = currentStock.trim() === "" ? 0 : Number(currentStock);
    const minNum = minStockLevel.trim() === "" ? 0 : Number(minStockLevel);
    const taxNum = taxRate.trim() === "" ? 0 : Number(taxRate);

    if (!Number.isFinite(costNum) || costNum < 0) {
      setErr("Enter a valid purchase cost (0 or higher).");
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setErr("Enter a valid selling price (0 or higher).");
      return;
    }
    if (!Number.isFinite(stockNum) || stockNum < 0) {
      setErr("Opening stock cannot be negative.");
      return;
    }
    if (!Number.isFinite(minNum) || minNum < 0) {
      setErr("Minimum alert level cannot be negative.");
      return;
    }
    if (!Number.isFinite(taxNum) || taxNum < 0 || taxNum > 100) {
      setErr("Tax % must be between 0 and 100.");
      return;
    }

    setSaving(true);
    setErr("");
    try {
      const supName = suppliers.find((s) => s.id === supplierId)?.name;
      await onSave({
        name: name.trim(),
        sku: sku.trim(),
        barcode: barcode.trim() || undefined,
        category: category.trim() || "General",
        brand: brand.trim() || undefined,
        description: description.trim() || undefined,
        unit,
        purchaseCost: Math.max(0, costNum),
        sellingPrice: Math.max(0, priceNum),
        currentStock: roundQty(Math.max(0, stockNum)),
        minStockLevel: roundQty(Math.max(0, minNum)),
        supplierId: supplierId || undefined,
        supplierName: supName,
        taxRate: Math.max(0, taxNum),
        expiryDate: expiryDate || undefined,
        hasVariants,
        isActive,
      });
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Failed to save product.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? "Edit Product" : "Add Product"}
      subtitle={product ? "Update product details and pricing." : "Add a new item to your inventory."}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {err && <div className="p-3 rounded-lg bg-[#C84C4C]/10 text-xs text-[#C84C4C]">{err}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel label="Product Name" required />
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Basmati Rice 5kg" required />
          </div>
          <div>
            <FieldLabel label="Category" required />
            <TextInput value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Grains, Apparel" required />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <FieldLabel label="SKU" required />
            <TextInput value={sku} onChange={(e) => setSku(e.target.value)} required />
          </div>
          <div>
            <FieldLabel label="Barcode" hint="Optional" />
            <TextInput value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="EAN / UPC" />
          </div>
          <div>
            <FieldLabel label="Unit" required />
            <SelectInput value={unit} onChange={(e) => setUnit(e.target.value as ProductUnit)}>
              {PRODUCT_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </SelectInput>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <FieldLabel label={`Buy Cost (${currency})`} required />
            <TextInput
              type="text"
              inputMode="decimal"
              value={purchaseCost}
              onChange={(e) => {
                const clean = sanitizeDecimalInput(e.target.value, 2);
                if (clean !== null) setPurchaseCost(clean);
              }}
              onKeyDown={(e) => {
                if (e.key === "Backspace" || e.key === "Delete") e.stopPropagation();
              }}
              placeholder="0.00"
              required
            />
          </div>
          <div>
            <FieldLabel label={`Sell Price (${currency})`} required />
            <TextInput
              type="text"
              inputMode="decimal"
              value={sellingPrice}
              onChange={(e) => {
                const clean = sanitizeDecimalInput(e.target.value, 2);
                if (clean !== null) setSellingPrice(clean);
              }}
              onKeyDown={(e) => {
                if (e.key === "Backspace" || e.key === "Delete") e.stopPropagation();
              }}
              placeholder="0.00"
              required
            />
          </div>
          <div>
            <FieldLabel label={product ? "Current Stock" : "Opening Stock"} />
            <TextInput
              type="text"
              inputMode="decimal"
              value={currentStock}
              onChange={(e) => {
                const clean = sanitizeDecimalInput(e.target.value, 3);
                if (clean !== null) setCurrentStock(clean);
              }}
              onKeyDown={(e) => {
                if (e.key === "Backspace" || e.key === "Delete") e.stopPropagation();
              }}
              disabled={Boolean(product)}
              title={product ? "Use Adjust Stock to change stock with audit trail" : undefined}
            />
          </div>
          <div>
            <FieldLabel label="Min Alert Level" />
            <TextInput
              type="text"
              inputMode="decimal"
              value={minStockLevel}
              onChange={(e) => {
                const clean = sanitizeDecimalInput(e.target.value, 3);
                if (clean !== null) setMinStockLevel(clean);
              }}
              onKeyDown={(e) => {
                if (e.key === "Backspace" || e.key === "Delete") e.stopPropagation();
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <FieldLabel label="Brand" hint="Optional" />
            <TextInput value={brand} onChange={(e) => setBrand(e.target.value)} />
          </div>
          <div>
            <FieldLabel label="Default Supplier" />
            <SelectInput value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">None selected</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectInput>
          </div>
          <div>
            <FieldLabel label="Tax % (GST/VAT)" />
            <TextInput
              type="text"
              inputMode="decimal"
              value={taxRate}
              onChange={(e) => {
                const clean = sanitizeDecimalInput(e.target.value, 2);
                if (clean !== null) setTaxRate(clean);
              }}
              onKeyDown={(e) => {
                if (e.key === "Backspace" || e.key === "Delete") e.stopPropagation();
              }}
              placeholder="0"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel label="Expiry Date" hint="If perishable" />
            <TextInput type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </div>
          <div>
            <FieldLabel label="Description / Notes" hint="Optional" />
            <TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Shelf location or details" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 pt-2">
          <label className="flex items-center gap-2 text-xs text-[#17263C] cursor-pointer">
            <input
              type="checkbox"
              checked={hasVariants}
              onChange={(e) => setHasVariants(e.target.checked)}
              className="w-4 h-4 accent-[#147D75]"
            />
            Product has size/color variations
          </label>
          <label className="flex items-center gap-2 text-xs text-[#17263C] cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 accent-[#147D75]"
            />
            Active (available for sale)
          </label>
        </div>

        <div className="pt-4 border-t border-[#E6EAE9] flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="accent" disabled={saving}>
            {saving ? "Saving..." : product ? "Save Changes" : "Add Product"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function StockAdjustModal({
  open,
  onClose,
  target,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  target: { product: Product; variant?: ProductVariant };
  onConfirm: (
    movementType: "ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "DAMAGED_OUT" | "EXPIRED_OUT" | "RECONCILIATION",
    qty: number,
    reason: string
  ) => Promise<void>;
}) {
  const current = target.variant ? target.variant.currentStock : target.product.currentStock;
  const label = target.variant
    ? `${target.product.name} (${target.variant.variantName})`
    : target.product.name;

  const [movementType, setMovementType] = useState<
    "ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "DAMAGED_OUT" | "EXPIRED_OUT" | "RECONCILIATION"
  >("ADJUSTMENT_IN");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = qty.trim();
    const num = trimmed === "" ? NaN : Number(trimmed);
    if (!Number.isFinite(num) || num < 0 || (movementType !== "RECONCILIATION" && num <= 0)) {
      setErr(
        movementType === "RECONCILIATION"
          ? "Enter a valid physical stock count (0 or higher)."
          : "Enter a valid positive quantity greater than 0."
      );
      return;
    }
    if (!reason.trim()) {
      setErr("Please enter a short reason for the stock audit log.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await onConfirm(movementType, num, reason.trim());
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Failed to update stock.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adjust or Reconcile Stock"
      subtitle={`${label} · Current stock: ${current} ${target.product.unit}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {err && <div className="p-3 rounded-lg bg-[#C84C4C]/10 text-xs text-[#C84C4C]">{err}</div>}
        <div>
          <FieldLabel label="Adjustment Type" required />
          <SelectInput
            value={movementType}
            onChange={(e) =>
              setMovementType(
                e.target.value as
                  | "ADJUSTMENT_IN"
                  | "ADJUSTMENT_OUT"
                  | "DAMAGED_OUT"
                  | "EXPIRED_OUT"
                  | "RECONCILIATION"
              )
            }
          >
            <option value="ADJUSTMENT_IN">Add Stock (+)</option>
            <option value="ADJUSTMENT_OUT">Remove Stock (-)</option>
            <option value="DAMAGED_OUT">Damaged Stock (-)</option>
            <option value="EXPIRED_OUT">Expired Stock (-)</option>
            <option value="RECONCILIATION">Physical Count Reconciliation (Set Exact Count)</option>
          </SelectInput>
        </div>

        <div>
          <FieldLabel
            label={
              movementType === "RECONCILIATION"
                ? `Actual Counted Stock (${target.product.unit})`
                : `Quantity (${target.product.unit})`
            }
            required
          />
          <TextInput
            type="text"
            inputMode="decimal"
            value={qty}
            onChange={(e) => {
              const clean = sanitizeDecimalInput(e.target.value, 3);
              if (clean !== null) setQty(clean);
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" || e.key === "Delete") e.stopPropagation();
            }}
            placeholder={movementType === "RECONCILIATION" ? String(current) : "1"}
            required
          />
        </div>

        <div>
          <FieldLabel label="Reason (Saved in Audit Ledger)" required />
          <TextInput
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Shelf count verification, broken packet"
            required
          />
        </div>

        <div className="pt-3 border-t border-[#E6EAE9] flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Updating..." : "Save Stock Adjustment"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function VariantManagerModal({
  open,
  onClose,
  product,
  variants,
  currency,
  onAddVariant,
  onAdjustVariant,
}: {
  open: boolean;
  onClose: () => void;
  product: Product;
  variants: ProductVariant[];
  currency: string;
  onAddVariant: (v: {
    variantName: string;
    sku: string;
    purchaseCost: number;
    sellingPrice: number;
    currentStock: number;
    minStockLevel: number;
    isActive: boolean;
  }) => Promise<void>;
  onAdjustVariant: (variant: ProductVariant) => void;
}) {
  const [variantName, setVariantName] = useState("");
  const [sku, setSku] = useState(`${product.sku}-${variants.length + 1}`);
  const [cost, setCost] = useState(String(product.purchaseCost));
  const [price, setPrice] = useState(String(product.sellingPrice));
  const [stock, setStock] = useState("0");
  const [minStock, setMinStock] = useState("3");
  const [busy, setBusy] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!variantName.trim()) return;
    setBusy(true);
    try {
      await onAddVariant({
        variantName: variantName.trim(),
        sku: sku.trim() || `${product.sku}-V`,
        purchaseCost: Math.max(0, Number(cost) || 0),
        sellingPrice: Math.max(0, Number(price) || 0),
        currentStock: Math.max(0, Number(stock) || 0),
        minStockLevel: Math.max(0, Number(minStock) || 0),
        isActive: true,
      });
      setVariantName("");
      setStock("0");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Variations — ${product.name}`}
      subtitle="Each variation maintains independent stock."
      maxWidth="max-w-xl"
    >
      <div className="space-y-5">
        {variants.length > 0 && (
          <div className="border border-[#E6EAE9] rounded-lg divide-y divide-[#E6EAE9]">
            {variants.map((v) => (
              <div key={v.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-semibold text-[#17263C]">{v.variantName}</p>
                  <p className="text-[#758195] font-mono-num">
                    {v.sku} · Cost {formatCurrency(v.purchaseCost, currency)} · Sell{" "}
                    {formatCurrency(v.sellingPrice, currency)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono-num font-semibold text-[#17263C]">
                    {v.currentStock} {product.unit}
                  </span>
                  <Button size="sm" variant="secondary" onClick={() => onAdjustVariant(v)}>
                    Adjust
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAdd} className="p-4 bg-[#F7F8F6] border border-[#E6EAE9] rounded-lg space-y-3">
          <p className="text-xs font-semibold text-[#17263C]">Add New Variation</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel label="Size / Color / Pack" required />
              <TextInput
                value={variantName}
                onChange={(e) => setVariantName(e.target.value)}
                placeholder="e.g. Medium / Black"
                required
              />
            </div>
            <div>
              <FieldLabel label="Variant SKU" required />
              <TextInput value={sku} onChange={(e) => setSku(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <FieldLabel label="Cost" />
              <TextInput
                type="text"
                inputMode="decimal"
                value={cost}
                onChange={(e) => {
                  const clean = sanitizeDecimalInput(e.target.value, 2);
                  if (clean !== null) setCost(clean);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" || e.key === "Delete") e.stopPropagation();
                }}
              />
            </div>
            <div>
              <FieldLabel label="Price" />
              <TextInput
                type="text"
                inputMode="decimal"
                value={price}
                onChange={(e) => {
                  const clean = sanitizeDecimalInput(e.target.value, 2);
                  if (clean !== null) setPrice(clean);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" || e.key === "Delete") e.stopPropagation();
                }}
              />
            </div>
            <div>
              <FieldLabel label="Opening Stock" />
              <TextInput
                type="text"
                inputMode="decimal"
                value={stock}
                onChange={(e) => {
                  const clean = sanitizeDecimalInput(e.target.value, 3);
                  if (clean !== null) setStock(clean);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" || e.key === "Delete") e.stopPropagation();
                }}
              />
            </div>
            <div>
              <FieldLabel label="Min Alert" />
              <TextInput
                type="text"
                inputMode="decimal"
                value={minStock}
                onChange={(e) => {
                  const clean = sanitizeDecimalInput(e.target.value, 3);
                  if (clean !== null) setMinStock(clean);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" || e.key === "Delete") e.stopPropagation();
                }}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="accent" size="sm" disabled={busy}>
              <Plus className="w-4 h-4" />
              {busy ? "Adding..." : "Add Variation"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

function ProductDetailModal({
  product,
  variants,
  movements,
  saleItems,
  purchaseItems,
  currency,
  dateFormat,
  onClose,
}: {
  product: Product;
  variants: ProductVariant[];
  movements: Array<{ id: string; movementType: string; quantityDelta: number; newStock: number; reason: string; transactionDate: string }>;
  saleItems: Array<{ id: string; quantity: number; lineTotal: number; transactionDate: string }>;
  purchaseItems: Array<{ id: string; quantity: number; unitCost: number; lineTotal: number }>;
  currency: string;
  dateFormat?: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  onClose: () => void;
}) {
  const margin = product.sellingPrice - product.purchaseCost;
  const marginPct = product.sellingPrice > 0 ? Math.round((margin / product.sellingPrice) * 100) : 0;

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={product.name}
      subtitle={`${product.category} · SKU ${product.sku}${product.brand ? ` · ${product.brand}` : ""}`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F7F8F6] border border-[#E6EAE9] rounded-lg p-3.5 text-xs">
          <div>
            <p className="text-[#758195]">Current Stock</p>
            <p className="text-base font-bold font-mono-num text-[#17263C] mt-0.5">
              {product.currentStock} {product.unit}
            </p>
          </div>
          <div>
            <p className="text-[#758195]">Purchase Cost</p>
            <p className="text-base font-bold font-mono-num text-[#17263C] mt-0.5">
              {formatCurrency(product.purchaseCost, currency)}
            </p>
          </div>
          <div>
            <p className="text-[#758195]">Selling Price</p>
            <p className="text-base font-bold font-mono-num text-[#17263C] mt-0.5">
              {formatCurrency(product.sellingPrice, currency)}
            </p>
          </div>
          <div>
            <p className="text-[#758195]">Gross Margin</p>
            <p className="text-base font-bold font-mono-num text-[#21865B] mt-0.5">
              {formatCurrency(margin, currency)} ({marginPct}%)
            </p>
          </div>
        </div>

        {variants.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-[#17263C] mb-2">Variations</h4>
            <div className="border border-[#E6EAE9] rounded-lg divide-y divide-[#E6EAE9] text-xs">
              {variants.map((v) => (
                <div key={v.id} className="px-3 py-2 flex justify-between">
                  <span>{v.variantName}</span>
                  <span className="font-mono-num">
                    {v.currentStock} {product.unit} · {formatCurrency(v.sellingPrice, currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="border border-[#E6EAE9] rounded-lg p-3.5">
            <h4 className="font-semibold text-[#17263C] mb-2">Sales History ({saleItems.length})</h4>
            {saleItems.length === 0 ? (
              <p className="text-[#758195]">No sales recorded yet.</p>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {saleItems.slice(0, 10).map((si) => (
                  <div key={si.id} className="flex justify-between">
                    <span className="text-[#758195] font-mono-num">
                      {formatDateDisplay(si.transactionDate, dateFormat)}
                    </span>
                    <span className="font-mono-num">
                      {si.quantity} {product.unit} · {formatCurrency(si.lineTotal, currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border border-[#E6EAE9] rounded-lg p-3.5">
            <h4 className="font-semibold text-[#17263C] mb-2">Purchase History ({purchaseItems.length})</h4>
            {purchaseItems.length === 0 ? (
              <p className="text-[#758195]">No purchases recorded yet.</p>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {purchaseItems.slice(0, 10).map((pi) => (
                  <div key={pi.id} className="flex justify-between">
                    <span className="font-mono-num">
                      +{pi.quantity} {product.unit}
                    </span>
                    <span className="font-mono-num text-[#758195]">
                      @ {formatCurrency(pi.unitCost, currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <History className="w-3.5 h-3.5 text-[#758195]" />
            <h4 className="text-xs font-semibold text-[#17263C]">Inventory Movement Ledger</h4>
          </div>
          {movements.length === 0 ? (
            <p className="text-xs text-[#758195]">No movements logged.</p>
          ) : (
            <div className="border border-[#E6EAE9] rounded-lg divide-y divide-[#E6EAE9] text-xs max-h-44 overflow-y-auto">
              {[...movements]
                .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))
                .map((m) => (
                  <div key={m.id} className="px-3 py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[#17263C] truncate">{m.reason}</p>
                      <p className="text-[11px] text-[#758195]">
                        {formatDateDisplay(m.transactionDate, dateFormat)} · {m.movementType}
                      </p>
                    </div>
                    <div className="text-right font-mono-num shrink-0">
                      <span className={m.quantityDelta >= 0 ? "text-[#21865B]" : "text-[#C84C4C]"}>
                        {m.quantityDelta >= 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                      </span>
                      <p className="text-[11px] text-[#758195]">Bal: {m.newStock}</p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function CsvImportModal({
  open,
  onClose,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (
    rows: Array<{
      name: string;
      sku: string;
      category: string;
      unit: ProductUnit;
      purchaseCost: number;
      sellingPrice: number;
      currentStock: number;
      minStockLevel: number;
      taxRate: number;
    }>
  ) => Promise<void>;
}) {
  const [csvText, setCsvText] = useState(
    "Name,SKU,Category,Unit,PurchaseCost,SellingPrice,CurrentStock,MinStockLevel,TaxRate\nToor Dal 1kg,GRC-TD-1,Grains,kg,135,165,40,10,0\nNotebook A4,STN-NB-1,Stationery,pcs,32,50,120,20,12"
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setCsvText(reader.result);
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    try {
      const lines = csvText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length < 2) {
        setErr("Provide a header row and at least one product row.");
        return;
      }
      const parsed = lines.slice(1).map((line, idx) => {
        const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        const unitRaw = (cols[3] || "pcs") as ProductUnit;
        const unit = PRODUCT_UNITS.includes(unitRaw) ? unitRaw : "pcs";
        return {
          name: cols[0] || `Product ${idx + 1}`,
          sku: cols[1] || `IMP-${Date.now()}-${idx}`,
          category: cols[2] || "General",
          unit,
          purchaseCost: Math.max(0, Number(cols[4]) || 0),
          sellingPrice: Math.max(0, Number(cols[5]) || 0),
          currentStock: Math.max(0, roundQty(Number(cols[6]) || 0)),
          minStockLevel: Math.max(0, roundQty(Number(cols[7]) || 5)),
          taxRate: Math.max(0, Number(cols[8]) || 0),
        };
      });
      setBusy(true);
      await onImport(parsed);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Failed to import CSV.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import Products from CSV"
      subtitle="Upload a CSV file or paste rows matching: Name, SKU, Category, Unit, PurchaseCost, SellingPrice, CurrentStock, MinStockLevel, TaxRate"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {err && <div className="p-3 rounded-lg bg-[#C84C4C]/10 text-xs text-[#C84C4C]">{err}</div>}
        <div>
          <FieldLabel label="Choose CSV File (Optional)" />
          <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} className="text-xs text-[#758195]" />
        </div>
        <div>
          <FieldLabel label="CSV Data" required />
          <textarea
            rows={7}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            className="w-full p-3 border border-[#E6EAE9] rounded-lg text-xs font-mono-num text-[#17263C] focus:outline-none focus:border-[#147D75]"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="accent" disabled={busy}>
            {busy ? "Importing..." : "Import Products"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
