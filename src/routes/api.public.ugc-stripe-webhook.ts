/**
 * Public Stripe webhook for the UGC monetization rebuild - follower
 * payments and creator payouts, entirely separate from
 * api.public.stripe-webhook.ts (MatchAI subscription billing, old product).
 * Same Stripe account, a second registered webhook endpoint/secret in the
 * Stripe dashboard, so the two products' events never mix.
 *
 * Idempotent: reuses the existing stripe_processed_events ledger keyed by
 * Stripe's own globally-unique event id.
 *
 * Configure these events in Stripe for THIS endpoint:
 *   checkout.session.completed
 *   payment_intent.succeeded
 *   charge.refunded
 *   charge.dispute.created
 *   account.updated (Connect - payouts_enabled flips)
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getStripe, PLATFORM_FEE_BPS, REFERRAL_SHARE_OF_PLATFORM_FEE_BPS } from "@/lib/ugc/stripe.server";

export const Route = createFileRoute("/api/public/ugc-stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const webhookSecret = process.env.UGC_STRIPE_WEBHOOK_SECRET;
        if (!webhookSecret) {
          console.error("[ugc-stripe-webhook] UGC_STRIPE_WEBHOOK_SECRET is not set; rejecting request");
          return new Response("webhook secret not configured", { status: 500 });
        }

        const signature = request.headers.get("stripe-signature") ?? "";
        const body = await request.text();
        const stripe = await getStripe();

        let event: import("stripe").Stripe.Event;
        try {
          event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
        } catch (error) {
          console.error("[ugc-stripe-webhook] signature verification failed", error);
          return new Response("bad signature", { status: 400 });
        }

        const { error: duplicateError } = await supabaseAdmin
          .from("stripe_processed_events")
          .insert({ event_id: event.id, event_type: event.type });
        if (duplicateError) {
          if ((duplicateError as { code?: string }).code === "23505") {
            return new Response("ok (replay)", { status: 200 });
          }
          console.error("[ugc-stripe-webhook] idempotency insert failed", duplicateError);
          return new Response("ledger error", { status: 500 });
        }

        try {
          if (event.type === "checkout.session.completed") {
            await handleCheckoutCompleted(event.data.object as import("stripe").Stripe.Checkout.Session);
          } else if (event.type === "account.updated") {
            await handleAccountUpdated(event.data.object as import("stripe").Stripe.Account);
          }
          // charge.refunded / charge.dispute.created: recording those against
          // ugc_transactions.status is a follow-up once real payment volume
          // exists to test against - not built in this pass.

          return new Response("ok", { status: 200 });
        } catch (error) {
          console.error("[ugc-stripe-webhook] handler failed", error);
          // Remove the idempotency marker so Stripe's retry can succeed later.
          await supabaseAdmin.from("stripe_processed_events").delete().eq("event_id", event.id);
          return new Response("handler error", { status: 500 });
        }
      },
    },
  },
});

async function handleCheckoutCompleted(session: import("stripe").Stripe.Checkout.Session) {
  const [agentId, followerId] = (session.client_reference_id ?? "").split(":");
  if (!agentId || !followerId) return;

  const { data: agent } = await supabaseAdmin.from("ugc_agents").select("creator_id").eq("id", agentId).single();
  if (!agent) return;

  await supabaseAdmin.from("ugc_agent_customers").upsert(
    {
      agent_id: agentId,
      follower_id: followerId,
      stripe_customer_id: (session.customer as string) ?? null,
      entitlement_status: "active",
      subscription_id: (session.subscription as string) ?? null,
    },
    { onConflict: "agent_id,follower_id" },
  );

  const gross = session.amount_total ?? 0;
  const platformFee = Math.round((gross * PLATFORM_FEE_BPS) / 10000);

  const { data: referral } = await supabaseAdmin
    .from("ugc_referrals")
    .select("id, expires_at")
    .eq("referred_creator_id", agent.creator_id)
    .maybeSingle();
  const referralActive = referral && new Date(referral.expires_at) > new Date();

  const { data: transaction } = await supabaseAdmin
    .from("ugc_transactions")
    .insert({
      agent_id: agentId,
      creator_id: agent.creator_id,
      follower_id: followerId,
      gross_cents: gross,
      platform_fee_cents: platformFee,
      creator_net_cents: gross - platformFee,
      stripe_charge_id: (session.payment_intent as string) ?? null,
      status: "succeeded",
    })
    .select("id")
    .single();

  if (referralActive && transaction) {
    const referralAmount = Math.round((platformFee * REFERRAL_SHARE_OF_PLATFORM_FEE_BPS) / 10000);
    await supabaseAdmin
      .from("ugc_referral_earnings")
      .insert({ referral_id: referral.id, transaction_id: transaction.id, amount_cents: referralAmount });
  }
}

async function handleAccountUpdated(account: import("stripe").Stripe.Account) {
  await supabaseAdmin
    .from("ugc_payout_accounts")
    .update({
      payouts_enabled: account.payouts_enabled ?? false,
      onboarding_status: account.details_submitted ? "complete" : "in_progress",
    })
    .eq("stripe_account_id", account.id);
}
