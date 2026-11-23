import React, { useState } from "react";
import { HelpCircle, X } from "lucide-react";

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "accent" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#147D75] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";
  const variants = {
    primary: "bg-[#17263C] text-white hover:bg-[#223552]",
    accent: "bg-[#147D75] text-white hover:bg-[#10665f]",
    secondary: "bg-white text-[#17263C] border border-[#E6EAE9] hover:bg-[#F7F8F6]",
    danger: "bg-[#C84C4C] text-white hover:bg-[#b03e3e]",
    ghost: "bg-transparent text-[#17263C] hover:bg-[#E6EAE9]/60",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-xs min-h-[36px] sm:min-h-[36px]",
    md: "px-4 py-2.5 text-sm min-h-[44px]",
    lg: "px-5 py-3 text-sm min-h-[48px]",
  };
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function FieldLabel({
  label,
  hint,
  required,
}: {
  label: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 mb-1.5">
      <label className="text-xs font-medium text-[#17263C]">
        {label}
        {required && <span className="text-[#C84C4C] ml-0.5">*</span>}
      </label>
      {hint && <span className="text-xs text-[#758195]">{hint}</span>}
    </div>
  );
}

export function TextInput({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full min-h-[44px] px-3 py-2 bg-white border border-[#E6EAE9] rounded-lg text-sm text-[#17263C] placeholder:text-[#758195]/70 focus:outline-none focus:border-[#147D75] transition-colors ${className}`}
      {...props}
    />
  );
}

export function SelectInput({
  className = "",
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full min-h-[44px] px-3 py-2 bg-white border border-[#E6EAE9] rounded-lg text-sm text-[#17263C] focus:outline-none focus:border-[#147D75] transition-colors ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        aria-label="Explanation"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="text-[#758195] hover:text-[#147D75] p-1 rounded cursor-pointer"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {open && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-60 p-2.5 bg-[#17263C] text-white text-xs leading-relaxed rounded-lg shadow-lg pointer-events-none">
          {text}
        </span>
      )}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  maxWidth = "max-w-xl",
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  maxWidth?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#17263C]/40 backdrop-blur-[1px] p-0 sm:p-4">
      <div
        className={`w-full ${maxWidth} bg-white border border-[#E6EAE9] rounded-t-2xl sm:rounded-xl max-h-[92vh] flex flex-col overflow-hidden`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[#E6EAE9]">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[#17263C] truncate">{title}</h2>
            {subtitle && <p className="text-xs text-[#758195] mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-[#758195] hover:bg-[#F7F8F6] hover:text-[#17263C] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="px-5 py-3.5 border-t border-[#E6EAE9] bg-[#F7F8F6] flex flex-wrap items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-[#E6EAE9] rounded-xl p-8 sm:p-10 text-center flex flex-col items-center justify-center">
      <div className="w-11 h-11 rounded-lg bg-[#F7F8F6] border border-[#E6EAE9] flex items-center justify-center text-[#147D75] mb-3.5">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-[#17263C]">{title}</h3>
      <p className="text-sm text-[#758195] max-w-md mt-1.5 leading-relaxed">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function StatusText({
  tone,
  label,
}: {
  tone: "success" | "warning" | "error" | "muted";
  label: string;
}) {
  const colors = {
    success: "text-[#21865B]",
    warning: "text-[#D99A31]",
    error: "text-[#C84C4C]",
    muted: "text-[#758195]",
  };
  return <span className={`text-xs font-medium ${colors[tone]}`}>{label}</span>;
}
