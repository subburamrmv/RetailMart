import React from "react";
import { Download, Printer, X } from "lucide-react";
import { formatCurrency, formatDateDisplay } from "../lib/finance";
import type { Business, Sale, SaleItem } from "../types/retail";
import { Button } from "./ui/Primitives";

export function ReceiptModal({
  open,
  onClose,
  business,
  sale,
  items,
}: {
  open: boolean;
  onClose: () => void;
  business: Business;
  sale: Sale | null;
  items: SaleItem[];
}) {
  if (!open || !sale) return null;

  const saleItems = items.filter((it) => it.saleId === sale.id);

  const handleDownloadText = () => {
    const lines = [
      business.name.toUpperCase(),
      business.address || "",
      business.phone ? `Tel: ${business.phone}` : "",
      "----------------------------------------",
      `Receipt: ${sale.receiptNumber}`,
      `Date: ${formatDateDisplay(sale.transactionDate, business.dateFormat)} ${new Date(sale.transactionDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      sale.customerName ? `Customer: ${sale.customerName}` : "",
      `Payment: ${sale.paymentMethod}  |  Status: ${sale.status}`,
      "----------------------------------------",
      ...saleItems.map(
        (it) =>
          `${it.productName} (${it.quantity} ${it.unit} x ${formatCurrency(it.unitPrice, business.currency)}) = ${formatCurrency(it.lineTotal, business.currency)}`
      ),
      "----------------------------------------",
      `Subtotal: ${formatCurrency(sale.subtotal, business.currency)}`,
      sale.discountAmount > 0 ? `Discount: -${formatCurrency(sale.discountAmount, business.currency)}` : "",
      sale.taxAmount > 0 ? `Tax: ${formatCurrency(sale.taxAmount, business.currency)}` : "",
      `TOTAL: ${formatCurrency(sale.totalAmount, business.currency)}`,
      `Paid: ${formatCurrency(sale.paidAmount, business.currency)}`,
      sale.creditAmount > 0 ? `Credit Due: ${formatCurrency(sale.creditAmount, business.currency)}` : "",
      "----------------------------------------",
      business.receiptFooter || "Thank you for your business!",
    ]
      .filter(Boolean)
      .join("\n");

    const blob = new Blob([lines], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sale.receiptNumber}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17263C]/45 p-4">
      <div className="bg-white border border-[#E6EAE9] rounded-xl max-w-md w-full overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E6EAE9] no-print">
          <h3 className="text-sm font-semibold text-[#17263C]">Receipt {sale.receiptNumber}</h3>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[#758195] hover:bg-[#F7F8F6] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto print-area bg-white text-[#17263C]">
          <div className="text-center border-b border-dashed border-[#E6EAE9] pb-4 mb-4">
            <h4 className="text-base font-bold">{business.name}</h4>
            {business.address && <p className="text-xs text-[#758195] mt-1">{business.address}</p>}
            {business.phone && <p className="text-xs text-[#758195]">Tel: {business.phone}</p>}
          </div>

          <div className="grid grid-cols-2 gap-y-1 text-xs mb-4">
            <span className="text-[#758195]">Receipt No.</span>
            <span className="text-right font-mono-num font-medium">{sale.receiptNumber}</span>
            <span className="text-[#758195]">Date & Time</span>
            <span className="text-right font-mono-num">
              {formatDateDisplay(sale.transactionDate, business.dateFormat)}{" "}
              {new Date(sale.transactionDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            {sale.customerName && (
              <>
                <span className="text-[#758195]">Customer</span>
                <span className="text-right font-medium">{sale.customerName}</span>
              </>
            )}
            <span className="text-[#758195]">Payment</span>
            <span className="text-right font-medium">{sale.paymentMethod.replace("_", " ")}</span>
          </div>

          <div className="border-t border-b border-dashed border-[#E6EAE9] py-3 space-y-2.5">
            {saleItems.map((it) => (
              <div key={it.id} className="flex items-start justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <p className="font-medium text-[#17263C]">{it.productName}</p>
                  <p className="text-[#758195] font-mono-num">
                    {it.quantity} {it.unit} × {formatCurrency(it.unitPrice, business.currency)}
                    {it.taxRate > 0 ? ` (+${it.taxRate}% tax)` : ""}
                  </p>
                  {it.returnedQuantity > 0 && (
                    <p className="text-[#D99A31] text-[11px]">Returned: {it.returnedQuantity} {it.unit}</p>
                  )}
                </div>
                <span className="font-mono-num font-medium shrink-0">
                  {formatCurrency(it.lineTotal, business.currency)}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-3 space-y-1.5 text-xs">
            <div className="flex justify-between text-[#758195]">
              <span>Subtotal</span>
              <span className="font-mono-num">{formatCurrency(sale.subtotal, business.currency)}</span>
            </div>
            {sale.discountAmount > 0 && (
              <div className="flex justify-between text-[#21865B]">
                <span>Discount</span>
                <span className="font-mono-num">-{formatCurrency(sale.discountAmount, business.currency)}</span>
              </div>
            )}
            {sale.taxAmount > 0 && (
              <div className="flex justify-between text-[#758195]">
                <span>Tax</span>
                <span className="font-mono-num">{formatCurrency(sale.taxAmount, business.currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold pt-2 border-t border-[#E6EAE9]">
              <span>Total</span>
              <span className="font-mono-num">{formatCurrency(sale.totalAmount, business.currency)}</span>
            </div>
            <div className="flex justify-between text-[#758195] pt-1">
              <span>Amount Paid</span>
              <span className="font-mono-num">{formatCurrency(sale.paidAmount, business.currency)}</span>
            </div>
            {sale.creditAmount > 0 && (
              <div className="flex justify-between text-[#D99A31] font-medium">
                <span>Balance Due (Credit)</span>
                <span className="font-mono-num">{formatCurrency(sale.creditAmount, business.currency)}</span>
              </div>
            )}
            {sale.refundedAmount > 0 && (
              <div className="flex justify-between text-[#C84C4C] font-medium">
                <span>Refunded / Reversed</span>
                <span className="font-mono-num">{formatCurrency(sale.refundedAmount, business.currency)}</span>
              </div>
            )}
          </div>

          <p className="text-center text-[11px] text-[#758195] mt-6 pt-3 border-t border-dashed border-[#E6EAE9]">
            {business.receiptFooter || "Thank you for shopping with us!"}
          </p>
        </div>

        <div className="px-5 py-3.5 border-t border-[#E6EAE9] bg-[#F7F8F6] flex items-center justify-end gap-2.5 no-print">
          <Button variant="secondary" size="sm" onClick={handleDownloadText}>
            <Download className="w-4 h-4" />
            Download
          </Button>
          <Button variant="primary" size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4" />
            Print Receipt
          </Button>
        </div>
      </div>
    </div>
  );
}
