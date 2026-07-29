/**
 * Public Stripe webhook for MatchAI subscription billing.
 *
 * Stripe is used only for payments from MatchAI users to MatchAI. Creator-brand
 * payments happen outside MatchAI and must never be handled by this endpoint.
 *
 * Idempotent: every Stripe event id is recorded before state is mutated. If a
 * handler fails, the marker is removed so Stripe can safely retry the event.
 *
 * Configure these events in Stripe:
 *   customer.subscription.created
 *   customer.subscription.updated
 *   customer.subscription.deleted
 *   invoice.paid
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.STRIPE_SECRET_KEY;
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!secret) {
          return new Response("stripe not configured", { status: 500 });
        }
        if (!webhookSecret) {
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
          event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
        } catch (error) {
          console.error("[stripe-webhook] signature verification failed", error);
          return new Response("bad signature", { status: 400 });
        }

        const supportedEvents = new Set([
          "customer.subscription.created",
          "customer.subscription.updated",
          "customer.subscription.deleted",
          "invoice.paid",
        ]);
        if (!supportedEvents.has(event.type)) {
          return new Response("ignored", { status: 200 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error: duplicateError } = await supabaseAdmin
          .from("stripe_processed_events")
          .insert({ event_id: event.id, event_type: event.type });
        if (duplicateError) {
          if ((duplicateError as { code?: string }).code === "23505") {
            return new Response("ok (replay)", { status: 200 });
          }
          console.error("[stripe-webhook] idempotency insert failed", duplicateError);
          return new Response("ledger error", { status: 500 });
        }

        try {
          if (
            event.type === "customer.subscription.created" ||
            event.type === "customer.subscription.updated" ||
            event.type === "customer.subscription.deleted"
          ) {
            const subscription = event.data.object as unknown as {
              id: string;
              status: string;
              cancel_at_period_end?: boolean;
              current_period_end?: number | null;
              customer: string;
              metadata?: { user_id?: string; plan?: string };
            };
            const userId = subscription.metadata?.user_id;
            const plan = subscription.metadata?.plan;

            if (userId) {
              await supabaseAdmin.from("subscriptions").upsert(
                {
                  user_id: userId,
                  plan: plan ?? "free",
                  status: subscription.status,
                  cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
                  current_period_end: subscription.current_period_end
                    ? new Date(subscription.current_period_end * 1000).toISOString()
                    : null,
                  stripe_customer_id: subscription.customer,
                  stripe_subscription_id: subscription.id,
                },
                { onConflict: "user_id" },
              );

              const active =
                event.type !== "customer.subscription.deleted" &&
                (subscription.status === "active" || subscription.status === "trialing");
              await supabaseAdmin
                .from("profiles")
                .update({ plan: active && plan ? plan : "free" })
                .eq("user_id", userId);
            }
          }

          if (event.type === "invoice.paid") {
            const invoice = event.data.object as unknown as {
              subscription?: string | null;
              period_end?: number | null;
            };
            if (invoice.subscription) {
              await supabaseAdmin
                .from("subscriptions")
                .update({
                  status: "active",
                  current_period_end: invoice.period_end
                    ? new Date(invoice.period_end * 1000).toISOString()
                    : null,
                })
                .eq("stripe_subscription_id", invoice.subscription);
            }
          }

          return new Response("ok", { status: 200 });
        } catch (error) {
          console.error("[stripe-webhook] handler failure", error);
          await supabaseAdmin.from("stripe_processed_events").delete().eq("event_id", event.id);
          return new Response("handler error", { status: 500 });
        }
      },
    },
  },
});
