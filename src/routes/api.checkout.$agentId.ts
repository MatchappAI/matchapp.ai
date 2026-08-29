import { createFileRoute } from "@tanstack/react-router";
import { getUserIdFromRequest } from "@/lib/chat-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getStripe, PLATFORM_FEE_BPS } from "@/lib/ugc/stripe.server";

export const Route = createFileRoute("/api/checkout/$agentId")({
  server: {
    handlers: {
      /** Creates a Stripe Checkout session for a follower subscribing to one agent. */
      POST: async ({ request, params }) => {
        const followerId = await getUserIdFromRequest(request);
        if (!followerId) return new Response("Unauthorized", { status: 401 });

        const { data: agent } = await supabaseAdmin
          .from("ugc_agents")
          .select("*")
          .eq("id", params.agentId)
          .eq("published", true)
          .maybeSingle();
        if (!agent) return new Response("agent not found", { status: 404 });

        const { data: payout } = await supabaseAdmin
          .from("ugc_payout_accounts")
          .select("stripe_account_id, payouts_enabled")
          .eq("creator_id", agent.creator_id)
          .maybeSingle();
        if (!payout?.stripe_account_id || !payout.payouts_enabled) {
          return new Response("creator has not finished payout setup", { status: 409 });
        }

        const stripe = await getStripe();
        const origin = new URL(request.url).origin;

        const session = await stripe.checkout.sessions.create({
          mode: agent.price_model === "subscription" ? "subscription" : "payment",
          line_items: [
            {
              price_data: {
                currency: "usd",
                unit_amount: agent.price_cents,
                product_data: { name: agent.name },
                ...(agent.price_model === "subscription" ? { recurring: { interval: "month" } } : {}),
              },
              quantity: 1,
            },
          ],
          payment_intent_data:
            agent.price_model === "one_time"
              ? {
                  application_fee_amount: Math.round((agent.price_cents * PLATFORM_FEE_BPS) / 10000),
                  transfer_data: { destination: payout.stripe_account_id },
                }
              : undefined,
          subscription_data:
            agent.price_model === "subscription"
              ? {
                  application_fee_percent: PLATFORM_FEE_BPS / 100,
                  transfer_data: { destination: payout.stripe_account_id },
                }
              : undefined,
          client_reference_id: `${agent.id}:${followerId}`,
          success_url: `${origin}/@${agent.slug}/chat?checkout=success`,
          cancel_url: `${origin}/@${agent.slug}?checkout=canceled`,
        });

        return Response.json({ url: session.url });
      },
    },
  },
});
