import { createFileRoute } from "@tanstack/react-router";
import { getUserIdFromRequest } from "@/lib/chat-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/creator/analytics")({
  server: {
    handlers: {
      /** Revenue, conversion, usage, AI cost, referrals - for the creator's own dashboard. */
      GET: async ({ request }) => {
        const creatorId = await getUserIdFromRequest(request);
        if (!creatorId) return new Response("Unauthorized", { status: 401 });

        const [{ data: transactions }, { data: customers }, { data: messages }, { data: referralEarnings }] =
          await Promise.all([
            supabaseAdmin.from("ugc_transactions").select("gross_cents, creator_net_cents, status").eq("creator_id", creatorId),
            supabaseAdmin
              .from("ugc_agent_customers")
              .select("entitlement_status, agent_id, ugc_agents!inner(creator_id)")
              .eq("ugc_agents.creator_id", creatorId),
            supabaseAdmin
              .from("ugc_messages")
              .select("token_usage, cost_usd, ugc_conversations!inner(agent_id, ugc_agents!inner(creator_id))")
              .eq("ugc_conversations.ugc_agents.creator_id", creatorId),
            supabaseAdmin
              .from("ugc_referral_earnings")
              .select("amount_cents, status, ugc_referrals!inner(referrer_creator_id)")
              .eq("ugc_referrals.referrer_creator_id", creatorId),
          ]);

        const succeeded = (transactions ?? []).filter((t) => t.status === "succeeded");
        const revenueCents = succeeded.reduce((sum, t) => sum + t.creator_net_cents, 0);
        const grossCents = succeeded.reduce((sum, t) => sum + t.gross_cents, 0);
        const activeCustomers = (customers ?? []).filter((c) => c.entitlement_status === "active").length;
        const trialCustomers = (customers ?? []).filter((c) => c.entitlement_status === "trial").length;
        const conversionRate = trialCustomers + activeCustomers > 0 ? activeCustomers / (trialCustomers + activeCustomers) : 0;
        const aiCostUsd = (messages ?? []).reduce((sum, m) => sum + (m.cost_usd ?? 0), 0);
        const referralEarningsCents = (referralEarnings ?? []).reduce((sum, r) => sum + r.amount_cents, 0);

        return Response.json({
          revenueCents,
          grossCents,
          activeCustomers,
          trialCustomers,
          conversionRate,
          aiCostUsd,
          referralEarningsCents,
        });
      },
    },
  },
});
