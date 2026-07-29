// Client-side rate suggestions built from CreatorSetup + light industry
// benchmarks. Not authoritative — the agent still refines per brand/scope.
import type { CreatorSetup } from "@/lib/creator-setup";

export type Deliverable =
  | "ig_post"
  | "ig_reel"
  | "ig_story"
  | "tiktok"
  | "ugc_video";

export const DELIVERABLE_LABELS: Record<Deliverable, string> = {
  ig_post: "Instagram feed post",
  ig_reel: "Instagram Reel",
  ig_story: "Instagram Story frame",
  tiktok: "TikTok video",
  ugc_video: "UGC video (unposted)",
};

/**
 * Base rate ranges for micro-creators (~10K–100K). Numbers are anchored
 * to publicly-reported market comps and MatchAI demo pricing.
 */
const BASE: Record<Deliverable, [number, number]> = {
  ig_post: [150, 800],
  ig_reel: [250, 1400],
  ig_story: [75, 350],
  tiktok: [200, 1200],
  ugc_video: [300, 1200],
};

export type RateSuggestion = {
  deliverable: Deliverable;
  low: number;
  mid: number;
  high: number;
  reason: string;
};

export function suggestRate(
  deliverable: Deliverable,
  setup: CreatorSetup | null | undefined,
): RateSuggestion {
  const [baseLow, baseHigh] = BASE[deliverable];
  let low = baseLow;
  let high = baseHigh;
  const reasons: string[] = [];

  // If the creator has explicitly set a rate, anchor around it.
  const explicit = setup?.rates?.[deliverable];
  if (typeof explicit === "number" && explicit > 0) {
    low = Math.round(explicit * 0.9);
    high = Math.round(explicit * 1.35);
    reasons.push("anchored to your saved rate");
  }

  // Broad usage / whitelisting bump
  if (setup?.usageRights?.whitelistingAllowed) {
    high = Math.round(high * 1.6);
    reasons.push("whitelisting available (+usage premium)");
  }
  if ((setup?.usageRights?.paidAmplificationDays ?? 0) > 0) {
    high = Math.round(high * 1.4);
    reasons.push("paid amplification (2–3× base)");
  }
  if ((setup?.usageRights?.exclusivityDays ?? 0) > 0) {
    high = Math.round(high * 1.15);
    reasons.push("exclusivity carries a premium");
  }

  // Niche premium
  const premiumNiches = ["Skincare", "Clean Beauty", "Fragrance", "Jewelry"];
  if (setup?.brandKit?.niches?.some((n) => premiumNiches.includes(n))) {
    high = Math.round(high * 1.15);
    reasons.push("premium niche");
  }

  const mid = Math.round((low + high) / 2);
  const reason =
    reasons.length > 0
      ? `Based on ${reasons.join(", ")}.`
      : "Based on micro-creator benchmarks. Add your rates in Creator setup for sharper numbers.";

  return { deliverable, low, mid, high, reason };
}

export function formatRange(s: RateSuggestion): string {
  const fmt = (n: number) => `$${n.toLocaleString()}`;
  return `${fmt(s.low)} – ${fmt(s.high)}`;
}
