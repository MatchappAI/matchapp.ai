import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PAID_PLAN_SLUGS, PLANS, type PaidPlanSlug } from "@/lib/plans";

async function getStripe() {
  const key = process.env.STRIPE_API_KEY;
  if (!key) throw new Error("STRIPE_API_KEY is not configured");
  const StripeMod = await import("stripe");
  const Stripe = StripeMod.default;
  return new Stripe(key, {
    apiVersion: "2026-05-27.dahlia",
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export const getSubscriptionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("subscriptions")
      .select("plan, status, current_period_end, cancel_at_period_end")
      .eq("user_id", userId)
      .maybeSingle();
    const isActive =
      !!data &&
      (data.status === "active" || data.status === "trialing") &&
      (!data.current_period_end || new Date(data.current_period_end) > new Date());
    return {
      isActive,
      plan: data?.plan ?? null,
      status: data?.status ?? null,
      cancelAtPeriodEnd: Boolean(data?.cancel_at_period_end),
      currentPeriodEnd: data?.current_period_end ?? null,
    };
  });

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      plan: z.enum(PAID_PLAN_SLUGS),
      origin: z.string().url(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId, claims } = context;
    const plan = PLANS[data.plan as PaidPlanSlug];
    const email = (claims as { email?: string } | null)?.email;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Reuse existing Stripe customer if we have one
    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    const stripe = await getStripe();

    let customerId = existing?.stripe_customer_id ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: email ?? undefined,
        metadata: { user_id: userId },
      });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: userId,
      metadata: { user_id: userId, plan: data.plan },
      // Stripe becomes merchant of record for the subscription charge:
      // handles tax calculation, filing, remittance, disputes, and
      // buyer-side support. MatchAI carries zero tax/legal obligation
      // on the subscription itself. Requires Stripe Tax + Managed
      // Payments to be enabled on the connected Stripe account.
      automatic_tax: { enabled: true },
      customer_update: { address: "auto", name: "auto" },
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      subscription_data: {
        metadata: { user_id: userId, plan: data.plan },
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: plan.monthlyCents,
            recurring: { interval: "month" },
            tax_behavior: "exclusive",
            product_data: {
              name: `MatchAI ${plan.name}`,
              // SaaS / cloud-based software tax code
              tax_code: "txcd_10000000",
            },
          },
        },
      ],
      success_url: `${data.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${data.origin}/#pricing`,
    });


    // Upsert a placeholder row so we know the intended plan
    await supabaseAdmin
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          plan: data.plan,
          status: existing ? undefined : "pending",
          stripe_customer_id: customerId,
        },
        { onConflict: "user_id" },
      );

    return { url: session.url as string };
  });

export const finalizeCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ sessionId: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const stripe = await getStripe();
    const session = await stripe.checkout.sessions.retrieve(data.sessionId, {
      expand: ["subscription"],
    });
    if (session.client_reference_id !== userId) {
      throw new Error("Session does not belong to this user");
    }
    const status = session.payment_status === "paid" ? "active" : "inactive";
    const sub = session.subscription as { id?: string; current_period_end?: number } | null;
    const planSlug = (session.metadata?.plan as string) ?? "starter";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          plan: planSlug,
          status,
          stripe_customer_id: (session.customer as string) ?? null,
          stripe_subscription_id: sub?.id ?? null,
          current_period_end: sub?.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
        },
        { onConflict: "user_id" },
      );
    // Mirror the active plan onto profiles.plan so quota checks see the upgrade
    // immediately (quota lookups read profiles.plan).
    if (status === "active") {
      await supabaseAdmin
        .from("profiles")
        .update({ plan: planSlug })
        .eq("user_id", userId);
    }
    return { status };
  });

/* ---------------- Stripe Connect (creator payouts) ---------------- */

/**
 * Returns the current creator's Stripe Connect onboarding state, refreshing
 * from Stripe if we already have an account_id so the dashboard can show
 * accurate "ready to receive payouts" status.
 */
export const getConnectStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_connect_account_id, stripe_connect_onboarded")
      .eq("user_id", userId)
      .maybeSingle();

    const accountId = profile?.stripe_connect_account_id ?? null;
    if (!accountId) {
      return { accountId: null as string | null, onboarded: false, payoutsEnabled: false, chargesEnabled: false };
    }

    try {
      const stripe = await getStripe();
      const account = await stripe.accounts.retrieve(accountId);
      const onboarded = Boolean(account.details_submitted && account.payouts_enabled);
      if (onboarded !== Boolean(profile?.stripe_connect_onboarded)) {
        await supabaseAdmin
          .from("profiles")
          .update({ stripe_connect_onboarded: onboarded })
          .eq("user_id", userId);
      }
      return {
        accountId,
        onboarded,
        payoutsEnabled: Boolean(account.payouts_enabled),
        chargesEnabled: Boolean(account.charges_enabled),
      };
    } catch (err) {
      console.error("[connect] retrieve failed", err);
      return {
        accountId,
        onboarded: Boolean(profile?.stripe_connect_onboarded),
        payoutsEnabled: false,
        chargesEnabled: false,
      };
    }
  });

/**
 * Creates (or reuses) a Stripe Connect Express account for the creator and
 * returns a one-time onboarding URL. The creator completes onboarding on
 * Stripe-hosted pages, then is redirected back to /dashboard/settings where
 * `getConnectStatus` re-reads the account and flips the flag.
 */
export const createConnectOnboardingLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ origin: z.string().url() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId, claims } = context;
    const email = (claims as { email?: string } | null)?.email;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_connect_account_id")
      .eq("user_id", userId)
      .maybeSingle();

    const stripe = await getStripe();
    let accountId = profile?.stripe_connect_account_id ?? null;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: email ?? undefined,
        capabilities: {
          transfers: { requested: true },
        },
        metadata: { user_id: userId },
      });
      accountId = account.id;
      await supabaseAdmin
        .from("profiles")
        .update({ stripe_connect_account_id: accountId, stripe_connect_onboarded: false })
        .eq("user_id", userId);
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${data.origin}/dashboard/settings?connect=refresh`,
      return_url: `${data.origin}/dashboard/settings?connect=return`,
    });

    return { url: link.url };
  });

/* ---------------- Subscription lifecycle (self-serve cancel/resume) ---------------- */

export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_subscription_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!sub?.stripe_subscription_id) {
      throw new Error("No active subscription found");
    }
    const stripe = await getStripe();
    const updated = (await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: true,
    })) as unknown as { current_period_end?: number | null };
    const periodEnd = updated.current_period_end ?? null;
    await supabaseAdmin
      .from("subscriptions")
      .update({
        cancel_at_period_end: true,
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      })
      .eq("user_id", userId);
    return { ok: true, cancelAt: periodEnd };
  });

export const resumeSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_subscription_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!sub?.stripe_subscription_id) throw new Error("No subscription found");
    const stripe = await getStripe();
    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: false,
    });
    await supabaseAdmin
      .from("subscriptions")
      .update({ cancel_at_period_end: false })
      .eq("user_id", userId);
    return { ok: true };
  });

