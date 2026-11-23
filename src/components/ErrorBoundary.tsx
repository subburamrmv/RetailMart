import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { RetailMateLogo } from "./BrandLogo";

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readable = error.message || "An unexpected error occurred.";
    try {
      const parsed = JSON.parse(readable) as { error?: string; operationType?: string; path?: string };
      if (parsed && parsed.error) {
        readable = `Database access error (${parsed.operationType || "operation"} on ${parsed.path || "record"}): ${parsed.error}`;
      }
    } catch {
      // keep raw message
    }
    return { hasError: true, errorMessage: readable };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F7F8F6] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-[#E6EAE9] rounded-xl p-6 space-y-4">
            <div className="pb-3 border-b border-[#E6EAE9]">
              <RetailMateLogo surface="light" size="sm" />
            </div>
            <div className="flex items-center gap-3 text-[#C84C4C]">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h1 className="text-lg font-semibold text-[#17263C]">Something needs attention</h1>
            </div>
            <p className="text-sm text-[#758195] leading-relaxed break-words">
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg bg-[#17263C] text-white text-sm font-medium hover:bg-[#1f324f] transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" />
              Reload RetailMate
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
