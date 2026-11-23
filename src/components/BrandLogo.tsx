import React from "react";

export function RetailMateIcon({
  size = 36,
  surface = "light",
  className = "",
}: {
  size?: number;
  surface?: "light" | "dark";
  className?: string;
}) {
  const tileFill = surface === "dark" ? "#147D75" : "#17263C";
  const canopyFill = surface === "dark" ? "#17263C" : "#147D75";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <rect width="40" height="40" rx="10" fill={tileFill} />
      {/* Storefront awning / geometric canopy */}
      <path
        d="M9.5 12.2C9.5 10.98 10.48 10 11.7 10H28.3C29.52 10 30.5 10.98 30.5 12.2V14.4C30.5 15.62 29.52 16.6 28.3 16.6H11.7C10.48 16.6 9.5 15.62 9.5 14.4V12.2Z"
        fill={canopyFill}
      />
      <path d="M12.2 13.3H27.8" stroke="#54C6B2" strokeWidth="1.6" strokeLinecap="round" />
      {/* Storefront architectural frame */}
      <path
        d="M11 16.6V28.8C11 29.74 11.76 30.5 12.7 30.5H27.3C28.24 30.5 29 29.74 29 28.8V16.6"
        stroke="#FFFFFF"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Rising growth bars inside the storefront */}
      <rect x="14.4" y="24.2" width="2.9" height="4.1" rx="0.7" fill="#54C6B2" />
      <rect x="18.55" y="22.1" width="2.9" height="6.2" rx="0.7" fill="#FFFFFF" />
      <rect x="22.7" y="19.5" width="2.9" height="8.8" rx="0.7" fill="#54C6B2" />
      {/* Subtle upward trend line */}
      <path
        d="M14 21.6L19.4 18.4L22.3 19.7L26.2 16.1"
        stroke="#FFFFFF"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RetailMateLogo({
  surface = "light",
  showTagline = false,
  size = "md",
  className = "",
}: {
  surface?: "light" | "dark";
  showTagline?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const iconSize = size === "sm" ? 28 : size === "lg" ? 42 : 34;
  const wordSize = size === "sm" ? "text-sm" : size === "lg" ? "text-xl" : "text-base";
  const primaryText = surface === "dark" ? "text-white" : "text-[#17263C]";
  const mateAccent = surface === "dark" ? "text-[#54C6B2]" : "text-[#147D75]";
  const taglineColor = surface === "dark" ? "text-white/65" : "text-[#758195]";

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <RetailMateIcon size={iconSize} surface={surface} />
      <div className="min-w-0 leading-tight">
        <span className={`font-bold tracking-tight whitespace-nowrap block ${wordSize} ${primaryText}`}>
          Retail<span className={mateAccent}>Mate</span>
        </span>
        {showTagline && (
          <span
            className={`block text-[10px] font-semibold tracking-[0.08em] mt-0.5 whitespace-nowrap ${taglineColor}`}
          >
            SMARTER BUSINESS. SIMPLER MANAGEMENT.
          </span>
        )}
      </div>
    </div>
  );
}
