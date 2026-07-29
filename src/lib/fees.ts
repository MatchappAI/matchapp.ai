/**
 * Single source of truth for fee vocabulary shown to creators, brands
 * and prospects. Every fee-bearing surface (landing, checkout, wallet,
 * deal detail, agent cards) MUST read from here — so copy stays
 * consistent and the four costs stay clearly separate:
 *
 *   1. MatchAI subscription  — recurring plan price (0 on Free)
 *   2. MatchAI success fee   — % of a MatchAI-sourced completed deal
 *   3. Stripe processing fee — charged by Stripe on protected payments
 *   4. Net creator payout    — what the creator actually receives
 *
 * MatchAI does NOT charge a 3% platform / escrow fee. Stripe charges
 * ~2.9% + $0.30 per US card charge and that money goes to Stripe.
 */

export const FEE_LABELS = {
  subscription: "MatchAI subscription",
  successFee: "MatchAI success fee",
  stripeProcessing: "Stripe payment processing",
  netPayout: "Net creator payout",
  gross: "Gross brand payment",
} as const;

export const FEE_COPY = {
  stripeDisclosure:
    "Stripe payment-processing fees (~2.9% + $0.30 on US cards) apply to protected payments and go to Stripe — not MatchAI.",
  successFeeDisclosure:
    "MatchAI success fees only apply to completed, paid deals sourced through MatchAI. Capped at $99/deal. 0% on repeat deals with the same brand.",
  subscriptionDisclosure:
    "MatchAI plans are billed monthly. Cancel anytime.",
  brandsNeverCharged:
    "Brands are never charged a MatchAI fee.",
} as const;

/** Stripe processing estimate (US card): 2.9% + $0.30 — passed through, NOT MatchAI revenue. */
export function stripeProcessingFee(grossUsd: number): number {
  if (grossUsd <= 0) return 0;
  return Math.round((grossUsd * 0.029 + 0.3) * 100) / 100;
}

/** Structured 4-line cost breakdown for any UI showing money flow on a paid deal. */
export function feeBreakdownRows(args: {
  grossUsd: number;
  matchaiFeeUsd: number;
}): Array<{ label: string; value: string; muted?: boolean; hint?: string }> {
  const stripe = stripeProcessingFee(args.grossUsd);
  const net = Math.max(0, Math.round((args.grossUsd - args.matchaiFeeUsd - stripe) * 100) / 100);
  const fmt = (n: number) => `$${n.toFixed(2)}`;
  return [
    { label: FEE_LABELS.gross, value: fmt(args.grossUsd) },
    { label: FEE_LABELS.successFee, value: fmt(args.matchaiFeeUsd), hint: "MatchAI" },
    { label: FEE_LABELS.stripeProcessing, value: fmt(stripe), muted: true, hint: "Charged by Stripe, not MatchAI" },
    { label: FEE_LABELS.netPayout, value: fmt(net) },
  ];
}
