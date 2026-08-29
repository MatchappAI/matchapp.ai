import { createFileRoute } from "@tanstack/react-router";
import { getUserIdFromRequest } from "@/lib/chat-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") +
    "-" +
    Math.random().toString(36).slice(2, 6)
  );
}

export const Route = createFileRoute("/api/agents")({
  server: {
    handlers: {
      /** Creates an agent from a selected opportunity. */
      POST: async ({ request }) => {
        const creatorId = await getUserIdFromRequest(request);
        if (!creatorId) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json()) as { opportunityId: string };
        if (!body.opportunityId) return new Response("opportunityId required", { status: 400 });

        const { data: opportunity, error: oppError } = await supabaseAdmin
          .from("ugc_agent_opportunities")
          .select("*")
          .eq("id", body.opportunityId)
          .eq("creator_id", creatorId)
          .single();
        if (oppError || !opportunity) return new Response("opportunity not found", { status: 404 });

        const { data: agent, error: agentError } = await supabaseAdmin
          .from("ugc_agents")
          .insert({
            creator_id: creatorId,
            slug: slugify(opportunity.title),
            name: opportunity.title,
            description: opportunity.job_to_be_done,
            price_cents: opportunity.suggested_price_cents ?? undefined,
          })
          .select("*")
          .single();
        if (agentError) return new Response(agentError.message, { status: 500 });

        await supabaseAdmin
          .from("ugc_agent_opportunities")
          .update({ status: "selected" })
          .eq("id", body.opportunityId);

        return Response.json({ agent });
      },
    },
  },
});
