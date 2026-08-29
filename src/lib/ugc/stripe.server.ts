/** Same Stripe client factory pattern as src/lib/payments.functions.ts. */
export async function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  const StripeMod = await import("stripe");
  const Stripe = StripeMod.default;
  return new Stripe(key, {
    apiVersion: "2026-05-27.dahlia",
    httpClient: Stripe.createFetchHttpClient(),
  });
}

/** MatchAI's platform cut - 20% of GMV, per the build packet. */
export const PLATFORM_FEE_BPS = 2000;

/** Referral discount to MatchAI's own cut - 25% of MatchAI's take = 5% of GMV, for 12 months. */
export const REFERRAL_SHARE_OF_PLATFORM_FEE_BPS = 2500;
