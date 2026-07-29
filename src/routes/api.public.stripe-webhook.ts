/**
 * Public Stripe webhook.
 *
 * Handles escrow funding (`checkout.session.completed`), subscription lifecycle
 * (`customer.subscription.*`, `invoice.paid`), and disputes
 * (`charge.dispute.*`) which freeze the matching escrow row so a release
 * cannot fire while funds are contested.
 *
 * Idempotent: every Stripe event id is recorded in `stripe_processed_events`
 * before we mutate our own tables. A replay of the same event returns 200
 * without touching anything twice — the ledger's PRIMARY KEY on `event_id`
 * is the source of truth.
 *
 * Configure in Stripe Dashboard → Developers → Webhooks:
 *   URL:     https://<project>.lovable.app/api/public/stripe-webhook
 *   Events:  checkout.session.completed, payment_intent.succeeded,
 *            customer.subscription.created|updated|deleted, invoice.paid,
 *            charge.dispute.created, charge.dispute.closed
 *   Secret:  set STRIPE_WEBHOOK_SECRET in project secrets
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.STRIPE_API_KEY;
        const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!secret) return new Response("stripe not configured", { status: 500 });
        if (!whSecret) {
          console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set; rejecting request");
          return new Response("webhook secret not configured", { status: 500 });
        }

        const signature = request.headers.get("stripe-signature") ?? "";
        const body = await request.text();

        const StripeMod = await import("stripe");
        const Stripe = StripeMod.default;
        const stripe = new Stripe(secret, {
          apiVersion: "2026-05-27.dahlia",
          httpClient: Stripe.createFetchHttpClient(),
        });

        let event: import("stripe").Stripe.Event;
        try {
          event = await stripe.webhooks.constructEventAsync(body, signature, whSecret);
        } catch (err) {
          console.error("[stripe-webhook] signature verification failed", err);
          return new Response("bad signature", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // -------- Idempotency guard --------
        // Insert first; if the row already exists (unique-violation), Stripe is
        // replaying an event we already handled — return 200 and do nothing.
        // This must precede any state-changing side effect.
        const { error: dupError } = await supabaseAdmin
          .from("stripe_processed_events")
          .insert({ event_id: event.id, event_type: event.type });
        if (dupError) {
          // 23505 = unique_violation → already processed.
          if ((dupError as { code?: string }).code === "23505") {
            return new Response("ok (replay)", { status: 200 });
          }
          console.error("[stripe-webhook] idempotency insert failed", dupError);
          return new Response("ledger error", { status: 500 });
        }

        try {
          if (event.type === "checkout.session.completed") {
            const s = event.data.object as import("stripe").Stripe.Checkout.Session;
            const escrowId = s.metadata?.escrow_id;
            if (escrowId) {
              const pi =
                typeof s.payment_intent === "string"
                  ? s.payment_intent
                  : s.payment_intent?.id ?? null;
              // Load auto_release_days so the scheduled release respects
              // any per-deal override (defaults to 3).
              const { data: escrowRow } = await supabaseAdmin
                .from("escrow_transactions")
                .select("auto_release_days")
                .eq("id", escrowId)
                .maybeSingle();
              const days = Number(escrowRow?.auto_release_days ?? 3);
              const releaseAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
              await supabaseAdmin
                .from("escrow_transactions")
                .update({
                  status: "funded",
                  funded_at: new Date().toISOString(),
                  stripe_payment_intent_id: pi,
                  release_scheduled_at: releaseAt.toISOString(),
                })
                .eq("id", escrowId);

              const dealId = s.metadata?.deal_id;
              if (dealId) {
                await supabaseAdmin
                  .from("deals")
                  .update({ escrow_status: "funded" })
                  .eq("id", dealId);
              }
            }
          }

          // -------- Dispute freeze --------
          // Any dispute on the payment intent freezes the escrow row so the
          // canonical release function refuses to move money until resolved.
          if (
            event.type === "charge.dispute.created" ||
            event.type === "charge.dispute.funds_withdrawn" ||
            event.type === "charge.dispute.updated"
          ) {
            const d = event.data.object as import("stripe").Stripe.Dispute;
            const pi = typeof d.payment_intent === "string" ? d.payment_intent : d.payment_intent?.id ?? null;
            if (pi) {
              await supabaseAdmin
                .from("escrow_transactions")
                .update({
                  dispute_status: "frozen",
                  dispute_reason: d.reason ?? "disputed",
                  disputed_at: new Date().toISOString(),
                })
                .eq("stripe_payment_intent_id", pi);
            }
          }
          if (event.type === "charge.dispute.closed" || event.type === "charge.dispute.funds_reinstated") {
            const d = event.data.object as import("stripe").Stripe.Dispute;
            const pi = typeof d.payment_intent === "string" ? d.payment_intent : d.payment_intent?.id ?? null;
            if (pi) {
              const won = d.status === "won" || event.type === "charge.dispute.funds_reinstated";
              await supabaseAdmin
                .from("escrow_transactions")
                .update({
                  dispute_status: won ? "resolved" : "frozen",
                  dispute_resolved_at: won ? new Date().toISOString() : null,
                })
                .eq("stripe_payment_intent_id", pi);
            }
          }

          if (
            event.type === "customer.subscription.updated" ||
            event.type === "customer.subscription.deleted" ||
            event.type === "customer.subscription.created"
          ) {
            const sub = event.data.object as unknown as {
              id: string;
              status: string;
              cancel_at_period_end?: boolean;
              current_period_end?: number | null;
              customer: string;
              metadata?: { user_id?: string; plan?: string };
            };
            const userId = sub.metadata?.user_id;
            const plan = sub.metadata?.plan;
            if (userId) {
              await supabaseAdmin
                .from("subscriptions")
                .update({
                  status: sub.status,
                  cancel_at_period_end: Boolean(sub.cancel_at_period_end),
                  current_period_end: sub.current_period_end
                    ? new Date(sub.current_period_end * 1000).toISOString()
                    : null,
                  stripe_subscription_id: sub.id,
                })
                .eq("user_id", userId);
              if (event.type === "customer.subscription.deleted") {
                await supabaseAdmin
                  .from("profiles")
                  .update({ plan: "free" })
                  .eq("user_id", userId);
              } else if (plan && (sub.status === "active" || sub.status === "trialing")) {
                await supabaseAdmin
                  .from("profiles")
                  .update({ plan })
                  .eq("user_id", userId);
              }
            }
          }

          if (event.type === "invoice.paid") {
            const inv = event.data.object as unknown as {
              subscription?: string | null;
              period_end?: number | null;
            };
            if (inv.subscription) {
              await supabaseAdmin
                .from("subscriptions")
                .update({
                  status: "active",
                  current_period_end: inv.period_end
                    ? new Date(inv.period_end * 1000).toISOString()
                    : null,
                })
                .eq("stripe_subscription_id", inv.subscription);
            }
          }

          return new Response("ok", { status: 200 });
        } catch (err) {
          // If handler crashes mid-flight, roll the idempotency row back so a
          // retry from Stripe can re-attempt the processing.
          console.error("[stripe-webhook] handler failure", err);
          await supabaseAdmin
            .from("stripe_processed_events")
            .delete()
            .eq("event_id", event.id);
          return new Response("handler error", { status: 500 });
        }
      },
    },
  },
});
