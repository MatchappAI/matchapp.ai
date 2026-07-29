import { DEMO_OPPORTUNITIES, type DemoOpportunity } from "@/lib/demo-mode";

export type EarnCategory =
  | "all"
  | "quick"
  | "ugc_match"
  | "licensing"
  | "sponsored"
  | "repeat_brand"
  | "monthly_retainer";

export const EARN_CATEGORIES: { id: EarnCategory; label: string }[] = [
  { id: "all", label: "All" },
  { id: "quick", label: "Quick earnings" },
  { id: "ugc_match", label: "Matched UGC" },
  { id: "licensing", label: "Existing-content licensing" },
  { id: "sponsored", label: "Sponsored content" },
  { id: "repeat_brand", label: "Repeat brand" },
  { id: "monthly_retainer", label: "Monthly retainer" },
];

export function deadlineLabel(iso?: string | null): {
  label: string;
  urgent: boolean;
} {
  if (!iso) return { label: "No deadline", urgent: false };
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return { label: "Closes today", urgent: true };
  const days = Math.ceil(ms / 86400_000);
  if (days <= 2) return { label: `Closes in ${days}d`, urgent: true };
  if (days <= 7) return { label: `Closes in ${days}d`, urgent: false };
  return { label: `Closes in ${days}d`, urgent: false };
}

export function pursuePrompt(opp: DemoOpportunity): string {
  const cm = opp.contentMatch;
  const pkg = cm?.suggestedPackage ?? opp.dealType;
  switch (opp.earnType) {
    case "licensing":
      return `Pursue ${opp.brand} as a licensing deal for ${cm?.matchedContent ?? "an existing piece of mine"}. Propose ${pkg}. No new content — pull the best existing example, draft the licensing offer with usage terms (${opp.usageRights}), verify the contact, and show it here for approval.`;
    case "quick":
      return `Pursue ${opp.brand} as a quick-earnings opportunity (${opp.effort ?? "fast"}). Deliverables: ${(opp.deliverables ?? []).join(", ") || opp.dealType}. Draft a short, direct pitch with the flat rate (${opp.estPayout}), verify the contact, and show it here for approval.`;
    case "repeat_brand":
      return `Pursue ${opp.brand} as a repeat-partner deal. 0% success fee. Reference our last collab, propose ${pkg}, verify the current contact, and show it here for approval.`;
    case "monthly_retainer":
      return `Pursue ${opp.brand} as a monthly retainer. Propose ${pkg} with recurring scope. Draft the retainer pitch, verify the contact, and show it here for approval.`;
    case "ugc_match":
      return `Pursue ${opp.brand} — matched UGC opportunity for ${cm?.matchedContent ?? "my recent content"}. Pick the best portfolio examples, propose ${pkg}, verify the contact, and show it here for approval.`;
    default:
      return `Pursue ${opp.brand}. Pick the best portfolio examples, propose ${pkg}, verify the contact, and show it here for approval before sending.`;
  }
}

export type EarnNudge = {
  id: string;
  message: string;
  opp?: DemoOpportunity;
  tone: "info" | "urgent" | "opportunity";
};

export function deriveNudges(opps: DemoOpportunity[] = DEMO_OPPORTUNITIES): EarnNudge[] {
  const nudges: EarnNudge[] = [];
  const newCount = opps.length;
  if (newCount > 0) {
    nudges.push({
      id: "new-count",
      message: `You have ${newCount} new ways to earn.`,
      tone: "info",
    });
  }
  const ugc = opps.find((o) => o.earnType === "ugc_match" && o.contentMatch);
  if (ugc) {
    nudges.push({
      id: `ugc-${ugc.id}`,
      message: `Your recent ${ugc.contentMatch!.matchedContent} matches a ${ugc.estPayout} opportunity.`,
      opp: ugc,
      tone: "opportunity",
    });
  }
  const lic = opps.find((o) => o.earnType === "licensing");
  if (lic) {
    nudges.push({
      id: `lic-${lic.id}`,
      message: `${lic.brand} may license content you already created.`,
      opp: lic,
      tone: "opportunity",
    });
  }
  const repeat = opps.find((o) => o.earnType === "repeat_brand");
  if (repeat) {
    nudges.push({
      id: `rep-${repeat.id}`,
      message: `A previous partner (${repeat.brand}) has a new product launch.`,
      opp: repeat,
      tone: "opportunity",
    });
  }
  const soon = opps.find((o) => deadlineLabel(o.deadlineIso).urgent);
  if (soon) {
    nudges.push({
      id: `soon-${soon.id}`,
      message: `${soon.brand} closes soon. Want me to pursue it?`,
      opp: soon,
      tone: "urgent",
    });
  }
  return nudges.slice(0, 4);
}
