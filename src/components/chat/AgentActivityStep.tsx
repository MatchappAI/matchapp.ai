/* eslint-disable react-refresh/only-export-components */
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A single visible "step" the agent takes during its turn — rendered inline
 * inside the assistant bubble so the creator literally watches the agent
 * work (open the Brands tab, look at Nike, draft the pitch, etc.).
 */
export function AgentActivityStep({ label, done }: { label: string; done: boolean }) {
  return (
    <div
      className={cn(
        "mt-1.5 flex items-center gap-2 rounded-lg border border-foreground/[0.06] bg-background/60 px-2.5 py-1.5 text-[11.5px]",
        done ? "text-foreground/80" : "text-foreground",
      )}
    >
      {done ? (
        <Check className="h-3 w-3 shrink-0 text-emerald-600" />
      ) : (
        <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />
      )}
      <span className="min-w-0 flex-1 break-words">{label}</span>
    </div>
  );
}

/** Human-friendly one-liner for each tool call. */
export function labelForToolCall(type: string, input: unknown, output: unknown): string {
  const inp = (input ?? {}) as Record<string, unknown>;
  const out = (output ?? {}) as Record<string, unknown>;
  switch (type) {
    case "navigateView": {
      const v = String(inp.view ?? out.view ?? "");
      const nice =
        v === "brands"
          ? "Brand Matches"
          : v === "approvals"
            ? "Replies"
            : v === "deals"
              ? "Deals"
              : v === "tracker"
                ? "Tracker"
                : v === "tools"
                  ? "Tools"
                  : v === "campaigns"
                    ? "Campaigns"
                    : v === "settings"
                      ? "Settings"
                      : v;
      return `Opening ${nice}`;
    }
    case "showBrandCard":
      return `Reviewing brand${out.brand_name ? ` — ${out.brand_name}` : ""}`;
    case "showDealCard":
      return `Pulling deal${out.brand_name ? ` — ${out.brand_name}` : ""}`;
    case "showBrandList":
      return `Ranking your top brand matches`;
    case "showReplyList":
      return `Checking replies waiting on you`;
    case "showEarnings":
      return `Reading live earnings`;
    case "showEmailDraft":
      return `Drafting outreach${inp.brandName ? ` for ${inp.brandName}` : ""}`;
    case "showReplyDraft":
      return `Drafting your reply${inp.brandName ? ` to ${inp.brandName}` : ""}`;
    case "showEmailThread":
      return `Pulling the ${inp.brandName ?? "brand"} email thread`;
    case "requestBrandPayment":
      return `Creating an external payment record`;
    case "proposeReleasePayment":
      return `Preparing payment status update for approval`;
    case "proposeRequestEscrow":
      return `Preparing payment status request for approval`;
    case "proposeMarkDelivered":
      return `Preparing delivery confirmation for approval`;
    case "proposeRememberPreference":
      return `Saving that as a rule for future work`;
    case "proposeApplyInsight":
      return `Preparing insight to apply`;
    default:
      return `Working on ${type}`;
  }
}
