/**
 * MatchAI monetization v2 — single source of truth.
 *
 * Model:
 *  - Free until a qualified paid brand reply arrives.
 *  - After the qualified reply, creator picks:
 *      • Stay Free: $0/mo + 20% success fee on paid MatchAI-sourced deals
 *      • Starter / Growth / Pro: monthly sub + 0% success fee
 *
 *  - Fee rate is LOCKED on the deal at acceptance and never changes
 *    retroactively when the creator's plan changes later.
 *  - Stripe processing fees are always disclosed separately and are
 *    NOT MatchAI revenue.
 */
import type { PlanSlug } from "./plans";

export type MonetizationChoice =
  | "undecided"
  | "stay_free_success_fee"
  | "starter_subscription"
  | "growth_subscription"
  | "pro_subscription";

export type DealSource =
  | "matchai_sourced"
  | "creator_sourced"
  | "existing_relationship"
  | "manual";

export type CommissionStatus =
  | "not_applicable"
  | "pending"
  | "charged"
  | "waived"
  | "refunded";

/**
 * Fair Deal Guarantee — hard cap on any single success fee. Above this
 * point the paid plans are always cheaper anyway, so the cap turns
 * "sticker shock" into a natural upgrade nudge rather than a punishment.
 */
export const SUCCESS_FEE_CAP_USD = 99;

/**
 * Free plan gets a small number of inbound brand threads (brands the
 * creator brings in themselves) so they can try the full unified-inbox
 * workflow. Paid plans are unlimited. Kept intentionally unspecified in
 * marketing copy ("limited inbound") so we can tune without a rewrite.
 */
export const FREE_INBOUND_THREAD_LIMIT = 3;

/** Success-fee rate (0-1) by monetization choice. */
export function getSuccessFeeRate(choice: MonetizationChoice): number {
  if (choice === "stay_free_success_fee") return 0.20;
  if (choice === "starter_subscription") return 0.10; // half the free rate — softer step up
  return 0; // Growth + Pro
}


export function monetizationChoiceForPlan(plan: PlanSlug | string | null | undefined): MonetizationChoice {
  switch (plan) {
    case "starter": return "starter_subscription";
    case "growth": return "growth_subscription";
    case "pro": return "pro_subscription";
    default: return "stay_free_success_fee";
  }
}

/** Stripe processing estimate (US card): 2.9% + $0.30. Passed through, not MatchAI revenue. */
export function estimateStripeProcessing(grossUsd: number): number {
  if (grossUsd <= 0) return 0;
  return Math.round((grossUsd * 0.029 + 0.30) * 100) / 100;
}

export type FeeBreakdown = {
  gross: number;
  successFeeRate: number;
  successFeeAmount: number;    // MatchAI revenue (already capped)
  successFeeUncapped: number;  // what fee would have been w/o cap
  feeCapped: boolean;
  repeatBrandWaived: boolean;
  paymentProcessingFee: number;
  creatorNet: number;
  commissionStatus: CommissionStatus;
  matchaiSourced: boolean;
};

export function computeFeeBreakdown(args: {
  gross: number;
  choice: MonetizationChoice;
  dealSource: DealSource;
  lockedRate?: number | null;
  nonCommissionable?: number;
  /** True if this creator already closed a prior paid MatchAI-sourced
   *  deal with the same brand. Repeat brand = 0% forever. */
  isRepeatBrand?: boolean;
}): FeeBreakdown {
  const gross = Math.max(0, Number(args.gross) || 0);
  const nonComm = Math.max(0, Number(args.nonCommissionable ?? 0));
  const commissionable = Math.max(0, gross - nonComm);

  const matchaiSourced = args.dealSource === "matchai_sourced";
  const repeatWaived = matchaiSourced && !!args.isRepeatBrand;
  const rateFromChoice = repeatWaived ? 0 : getSuccessFeeRate(args.choice);
  const rate =
    typeof args.lockedRate === "number" ? args.lockedRate :
    matchaiSourced ? rateFromChoice : 0;

  const uncapped = Math.round(commissionable * rate * 100) / 100;
  const successFeeAmount = Math.min(uncapped, SUCCESS_FEE_CAP_USD);
  const feeCapped = uncapped > SUCCESS_FEE_CAP_USD;

  const processing = estimateStripeProcessing(gross);
  const creatorNet = Math.round((gross - successFeeAmount - processing) * 100) / 100;

  const commissionStatus: CommissionStatus =
    successFeeAmount > 0 && matchaiSourced ? "pending" :
    repeatWaived ? "waived" : "not_applicable";

  return {
    gross,
    successFeeRate: rate,
    successFeeAmount,
    successFeeUncapped: uncapped,
    feeCapped,
    repeatBrandWaived: repeatWaived,
    paymentProcessingFee: processing,
    creatorNet,
    commissionStatus,
    matchaiSourced,
  };
}

/**
 * Break-even math — when does a paid plan save the creator money vs the
 * 20% success fee (capped at $99/deal)?
 *
 *  - Growth / Pro = 0% fee, so break-even = plan price (commission fully replaces sub).
 *  - Starter = 10% fee, so upgrading only saves the *difference* (10%).
 *    Break-even commission at 20% = plan price / 0.5 = $98.
 */
export const PLAN_BREAK_EVEN_USD = {
  starter: 98,  // $49 / (0.20 - 0.10)
  growth: 99,   // $99 / 0.20 rounded — plan pays for itself once fees ≈ price
  pro: 199,
} as const;

export const PLAN_PRICE_USD = {
  starter: 49,
  growth: 99,
  pro: 199,
} as const;

export type BreakEvenSuggestion = {
  shouldNudge: boolean;
  recommendedPlan: "starter" | "growth" | "pro" | null;
  monthlyCommission: number;
  monthlySavings: number;
  message: string | null;
};

export function computeBreakEvenSuggestion(args: {
  currentPlan: PlanSlug | string | null | undefined;
  monthlyCommissionUsd: number;
}): BreakEvenSuggestion {
  const commission = Math.max(0, Number(args.monthlyCommissionUsd) || 0);
  const onFree = !args.currentPlan || args.currentPlan === "free";
  if (!onFree || commission <= 0) {
    return { shouldNudge: false, recommendedPlan: null, monthlyCommission: commission, monthlySavings: 0, message: null };
  }
  const rec: "starter" | "growth" | "pro" | null =
    commission >= PLAN_BREAK_EVEN_USD.pro ? "pro" :
    commission >= PLAN_BREAK_EVEN_USD.growth ? "growth" :
    commission >= PLAN_BREAK_EVEN_USD.starter ? "starter" : null;
  if (!rec) {
    return { shouldNudge: false, recommendedPlan: null, monthlyCommission: commission, monthlySavings: 0, message: null };
  }
  // Savings = commission you would have paid at Free's 20% MINUS
  // (plan price + commission you'd still pay at the plan's own rate).
  const planRate = rec === "starter" ? 0.10 : 0;
  const feesAtPlan = Math.round(commission * (planRate / 0.20) * 100) / 100;
  const savings = Math.round((commission - PLAN_PRICE_USD[rec] - feesAtPlan) * 100) / 100;
  const dollars = `$${Math.round(commission).toLocaleString()}`;
  const saved = `$${Math.round(savings).toLocaleString()}`;
  const price = `$${PLAN_PRICE_USD[rec]}`;
  return {
    shouldNudge: savings > 0,
    recommendedPlan: rec,
    monthlyCommission: commission,
    monthlySavings: savings,
    message:
      `quick heads up 💡 you've paid ${dollars} in success fees this month. ` +
      `${rec[0].toUpperCase() + rec.slice(1)} (${price}/mo) would've saved you ${saved}. want me to switch you?`,
  };
}


/** Marketing copy — kept here so UI and legal stay in sync. */
export const MONETIZATION_COPY = {
  headline: "Free until a paid brand deal lands.",
  sub:
    "MatchAI finds relevant brands, sends personalized pitches, and follows up automatically. When a paid opportunity is ready, pick a plan — or stay Free and pay a 20% success fee only on that deal.",
  compareLine: "We only get paid when you do.",

  agreementVersion: "2026-07-27.v1",
} as const;

/** Fair Deal Guarantee — the four promises on every deal. */
export const FAIR_DEAL_GUARANTEE = {
  title: "The Fair Deal Guarantee",
  items: [
    { label: "Fee capped at $99", body: "Our success fee on any single deal is never more than $99, no matter how big it gets." },
    { label: "Repeat deals are free", body: "Once you close one paid deal with a brand through MatchAI, every future deal with that same brand is 0% — forever." },
    { label: "See your net upfront", body: "Every deal shows what you'll keep before you accept — no surprise deductions at payout." },
    { label: "Receipts on every deal", body: "You always see what MatchAI did — brands found, pitches sent, follow-ups, negotiation moves." },
  ],
} as const;
