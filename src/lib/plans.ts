/**
 * Single source of truth for MatchAI plans, prices, and quotas.
 * Every server function, UI surface, and quota check imports from here so
 * checkout, billing display, and limits never drift apart.
 */

export type PlanSlug = "free" | "starter" | "growth" | "pro";

export type PlanDefinition = {
  slug: PlanSlug;
  name: string;
  /** Monthly price in whole USD (used for ROI math and UI display). */
  monthlyUsd: number;
  /** Monthly price in cents (used for Stripe `unit_amount`). */
  monthlyCents: number;
  /** Monthly outbound pitch cap. `Infinity` = unlimited. */
  monthlyPitchQuota: number;
  /** Monthly brand-match cap. `Infinity` = unlimited. */
  monthlyMatchQuota: number;
};

export const PLANS: Record<PlanSlug, PlanDefinition> = {
  free: {
    slug: "free",
    name: "Free",
    monthlyUsd: 0,
    monthlyCents: 0,
    // Free tier: outbound pitching is free until a brand replies. We give a
    // generous monthly outbound cap so creators can try the loop; the actual
    // upgrade nudge fires on first reply (handled in the inbound flow).
    monthlyPitchQuota: 25,
    monthlyMatchQuota: 50,
  },
  starter: {
    slug: "starter",
    name: "Starter",
    monthlyUsd: 49,
    monthlyCents: 4900,
    monthlyPitchQuota: 100,
    monthlyMatchQuota: 300,
  },
  growth: {
    slug: "growth",
    name: "Growth",
    monthlyUsd: 99,
    monthlyCents: 9900,
    monthlyPitchQuota: 250,
    monthlyMatchQuota: 750,
  },
  pro: {
    slug: "pro",
    name: "Pro",
    monthlyUsd: 199,
    monthlyCents: 19900,
    monthlyPitchQuota: 500,
    monthlyMatchQuota: 1500,
  },
};

export const PAID_PLAN_SLUGS = ["starter", "growth", "pro"] as const;
export type PaidPlanSlug = (typeof PAID_PLAN_SLUGS)[number];

/** Resolve a plan from a (possibly nullish or unknown) profile.plan string. */
export function resolvePlan(slug: string | null | undefined): PlanDefinition {
  if (!slug) return PLANS.free;
  const known = PLANS[slug as PlanSlug];
  return known ?? PLANS.free;
}

export const USAGE_ACTION_OUTREACH_SEND = "outreach_send" as const;
export const USAGE_ACTION_MATCH_BRANDS = "match_brands" as const;

/** Returns YYYY-MM for the current UTC month (used as usage_tracking.month_year). */
export function currentMonthYear(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7);
}
