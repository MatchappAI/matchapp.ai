import { AlertTriangle } from "lucide-react";

export function DemoBanner() {
  return (
    <div className="flex items-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-1.5 text-[12px] font-medium text-amber-900">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span>
        Demo mode — brands, contacts, and fit scores below are test data. Real outreach and payments
        are disabled until live brand discovery is connected.
      </span>
    </div>
  );
}
