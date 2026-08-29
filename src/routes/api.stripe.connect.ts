import { createFileRoute } from "@tanstack/react-router";
import { getUserIdFromRequest } from "@/lib/chat-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getStripe } from "@/lib/ugc/stripe.server";

export const Route = createFileRoute("/api/stripe/connect")({
  server: {
    handlers: {
      /** Starts (or resumes) a creator's Stripe Connect Express onboarding. */
      POST: async ({ request }) => {
        const creatorId = await getUserIdFromRequest(request);
        if (!creatorId) return new Response("Unauthorized", { status: 401 });

        const stripe = await getStripe();
        const origin = new URL(request.url).origin;

        const { data: payout } = await supabaseAdmin
          .from("ugc_payout_accounts")
          .select("stripe_account_id")
          .eq("creator_id", creatorId)
          .maybeSingle();

        let stripeAccountId = payout?.stripe_account_id;
        if (!stripeAccountId) {
          const account = await stripe.accounts.create({ type: "express" });
          await supabaseAdmin
            .from("ugc_payout_accounts")
            .upsert({ creator_id: creatorId, stripe_account_id: account.id, onboarding_status: "in_progress" });
          stripeAccountId = account.id;
        }

        const link = await stripe.accountLinks.create({
          account: stripeAccountId,
          type: "account_onboarding",
          refresh_url: `${origin}/creator/payouts?refresh=true`,
          return_url: `${origin}/creator/payouts?onboarding=complete`,
        });

        return Response.json({ url: link.url });
      },
    },
  },
});
