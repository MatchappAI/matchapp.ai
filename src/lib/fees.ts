/**
 * Shared money-copy helpers for surfaces that still need to refer to
 * MatchAI subscriptions and external creator-brand payment. No MatchAI
 * wallet, escrow, payout, or success-fee language should be presented
 * as an active product behavior.
 */

export const FEE_LABELS = {
  subscription: "MatchAI subscription",
  successFee: "External payment",
  stripeProcessing: "Stripe payment processing",
  netPayout: "External payment net",
  gross: "Gross external payment",
} as const;

export const FEE_COPY = {
  stripeDisclosure:
    "Stripe payment-processing fees (~2.9% + $0.30 on US cards) apply to subscription payments and go to Stripe — not MatchAI.",
  successFeeDisclosure:
    "Creator-brand payment is handled outside MatchAI and is never processed as an active wallet, escrow, or payout flow. MatchAI may charge a separate commission on selected deals if agreed up front.",
  subscriptionDisclosure: "MatchAI plans are billed monthly. Cancel anytime.",
  brandsNeverCharged:
    "Selected deals may include a MatchAI commission; payment still stays external.",
} as const;

/** Stripe processing estimate (US card): 2.9% + $0.30 — passed through, NOT MatchAI revenue. */
export function stripeProcessingFee(grossUsd: number): number {
  if (grossUsd <= 0) return 0;
  return Math.round((grossUsd * 0.029 + 0.3) * 100) / 100;
}

/** Structured 4-line breakdown for any UI showing a subscription plus external payment context. */
export function feeBreakdownRows(args: {
  grossUsd: number;
  matchaiFeeUsd: number;
}): Array<{ label: string; value: string; muted?: boolean; hint?: string }> {
  const stripe = stripeProcessingFee(args.grossUsd);
  const net = Math.max(0, Math.round((args.grossUsd - stripe) * 100) / 100);
  const fmt = (n: number) => `$${n.toFixed(2)}`;
  return [
    { label: FEE_LABELS.gross, value: fmt(args.grossUsd) },
    { label: FEE_LABELS.successFee, value: fmt(args.matchaiFeeUsd), hint: "External" },
    {
      label: FEE_LABELS.stripeProcessing,
      value: fmt(stripe),
      muted: true,
      hint: "Charged by Stripe, not MatchAI",
    },
    { label: FEE_LABELS.netPayout, value: fmt(net) },
  ];
}
