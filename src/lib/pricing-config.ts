/**
 * MatchAI monetization copy helpers.
 *
 * Model:
 *  - MatchAI subscriptions cover the product.
 *  - Creator-brand payments happen outside MatchAI.
 *  - MatchAI may charge a commission on selected deals, but it does not custody the money.
 *  - Stripe is used only for user-to-MatchAI subscription payments.
 */
import type { PlanSlug } from "./plans";

export type MonetizationChoice =
  | "undecided"
  | "stay_free_success_fee"
  | "starter_subscription"
  | "growth_subscription"
  | "pro_subscription";

export type DealSource = "matchai_sourced" | "creator_sourced" | "existing_relationship" | "manual";

export type CommissionStatus = "not_applicable" | "pending" | "charged" | "waived" | "refunded";

/**
 * Pricing guardrails for compatibility with older surfaces.
 */
export const SUCCESS_FEE_CAP_USD = 99;

/**
 * Free plan gets a small number of inbound brand threads (brands the
 * creator brings in themselves) so they can try the full unified-inbox
 * workflow. Paid plans are unlimited. Kept intentionally unspecified in
 * marketing copy ("limited inbound") so we can tune without a rewrite.
 */
export const FREE_INBOUND_THREAD_LIMIT = 3;

/** Compatibility placeholder for older fee math. Always zero in the current product scope. */
export function getSuccessFeeRate(choice: MonetizationChoice): number {
  return 0; // Growth + Pro
}

export function monetizationChoiceForPlan(
  plan: PlanSlug | string | null | undefined,
): MonetizationChoice {
  switch (plan) {
    case "starter":
      return "starter_subscription";
    case "growth":
      return "growth_subscription";
    case "pro":
      return "pro_subscription";
    default:
      return "stay_free_success_fee";
  }
}

/** Stripe processing estimate (US card): 2.9% + $0.30. Passed through, not MatchAI revenue. */
export function estimateStripeProcessing(grossUsd: number): number {
  if (grossUsd <= 0) return 0;
  return Math.round((grossUsd * 0.029 + 0.3) * 100) / 100;
}

export type FeeBreakdown = {
  gross: number;
  successFeeRate: number;
  successFeeAmount: number; // MatchAI revenue (already capped)
  successFeeUncapped: number; // what fee would have been w/o cap
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
  const matchaiSourced = args.dealSource === "matchai_sourced";
  const processing = estimateStripeProcessing(gross);
  const creatorNet = Math.round((gross - processing) * 100) / 100;

  return {
    gross,
    successFeeRate: 0,
    successFeeAmount: 0,
    successFeeUncapped: 0,
    feeCapped: false,
    repeatBrandWaived: false,
    paymentProcessingFee: processing,
    creatorNet,
    commissionStatus: "not_applicable",
    matchaiSourced,
  };
}

/** Break-even math retained for compatibility with older surfaces. */
export const PLAN_BREAK_EVEN_USD = {
  starter: 98,
  growth: 99,
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
    return {
      shouldNudge: false,
      recommendedPlan: null,
      monthlyCommission: commission,
      monthlySavings: 0,
      message: null,
    };
  }
  const rec: "starter" | "growth" | "pro" | null =
    commission >= PLAN_BREAK_EVEN_USD.pro
      ? "pro"
      : commission >= PLAN_BREAK_EVEN_USD.growth
        ? "growth"
        : commission >= PLAN_BREAK_EVEN_USD.starter
          ? "starter"
          : null;
  if (!rec) {
    return {
      shouldNudge: false,
      recommendedPlan: null,
      monthlyCommission: commission,
      monthlySavings: 0,
      message: null,
    };
  }
  const savings = Math.round((commission - PLAN_PRICE_USD[rec]) * 100) / 100;
  const dollars = `$${Math.round(commission).toLocaleString()}`;
  const saved = `$${Math.round(savings).toLocaleString()}`;
  const price = `$${PLAN_PRICE_USD[rec]}`;
  return {
    shouldNudge: savings > 0,
    recommendedPlan: rec,
    monthlyCommission: commission,
    monthlySavings: savings,
    message:
      `quick heads up 💡 your current MatchAI subscription is ${dollars} this month. ` +
      `${rec[0].toUpperCase() + rec.slice(1)} (${price}/mo) could be a better fit. want me to switch you?`,
  };
}

/** Marketing copy — kept here so UI and legal stay in sync. */
export const MONETIZATION_COPY = {
  headline: "Free until you want to upgrade MatchAI.",
  sub: "MatchAI finds relevant brands, sends personalized pitches, and follows up automatically. MatchAI subscriptions cover the product, while creator-brand payment stays external. Selected deals can include a separate MatchAI commission, agreed up front.",
  compareLine: "Creator-brand payment stays external; commission is separate where used.",

  agreementVersion: "2026-07-27.v1",
} as const;

/** Fair Deal Guarantee — the four promises on every deal. */
export const FAIR_DEAL_GUARANTEE = {
  title: "The Fair Deal Guarantee",
  items: [
    {
      label: "Subscriptions are clear",
      body: "You always know what MatchAI subscription you’re on before you confirm.",
    },
    {
      label: "External payment stays external",
      body: "Creator-brand payment is handled outside MatchAI and never through a wallet or payout flow. Where used, MatchAI commission is a separate agreement, not a money-moving feature.",
    },
    {
      label: "Internal inbox stays honest",
      body: "MatchAI never fabricates sent or synchronized email state.",
    },
    {
      label: "Receipts on every action",
      body: "You always see what MatchAI did — brands found, pitches sent, follow-ups, negotiation moves.",
    },
  ],
} as const;
