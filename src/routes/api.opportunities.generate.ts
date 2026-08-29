import { createFileRoute } from "@tanstack/react-router";
import { generateObject } from "ai";
import { z } from "zod";
import { getUserIdFromRequest } from "@/lib/chat-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getModel } from "@/lib/ai-provider.server";

const OpportunitiesSchema = z.object({
  opportunities: z
    .array(
      z.object({
        title: z.string().describe('e.g. "Personal Routine Advisor"'),
        jobToBeDone: z.string(),
        rationale: z.string(),
        scores: z.object({ demandFit: z.number(), contentCoverage: z.number(), monetizability: z.number() }),
        suggestedPriceCents: z.number(),
      }),
    )
    .length(3),
});

export const Route = createFileRoute("/api/opportunities/generate")({
  server: {
    handlers: {
      /** Generates and scores the top 3 AI-product concepts for a creator. */
      POST: async ({ request }) => {
        const creatorId = await getUserIdFromRequest(request);
        if (!creatorId) return new Response("Unauthorized", { status: 401 });

        const [{ data: profile }, { data: demandRuns }] = await Promise.all([
          supabaseAdmin.from("ugc_creator_profiles").select("*").eq("user_id", creatorId).maybeSingle(),
          supabaseAdmin
            .from("ugc_demand_research_runs")
            .select("summary_json")
            .eq("creator_id", creatorId)
            .order("created_at", { ascending: false })
            .limit(1),
        ]);

        if (!profile) return new Response("run /api/creator/analyze first", { status: 400 });

        const { object } = await generateObject({
          model: getModel("extraction"),
          schema: OpportunitiesSchema,
          prompt: `Creator profile: ${JSON.stringify(profile)}\nDemand research: ${JSON.stringify(demandRuns?.[0]?.summary_json ?? [])}\n\nPropose exactly 3 ranked, concrete AI-product concepts this creator could sell to their own followers. No brand deals. No voice/likeness cloning. Each must be a scoped chat-agent job-to-be-done, not a generic assistant.`,
        });

        const rows = object.opportunities.map((o) => ({
          creator_id: creatorId,
          title: o.title,
          job_to_be_done: o.jobToBeDone,
          rationale: o.rationale,
          scores_json: o.scores,
          suggested_price_cents: o.suggestedPriceCents,
        }));
        const { data: inserted, error } = await supabaseAdmin.from("ugc_agent_opportunities").insert(rows).select("*");
        if (error) return new Response(error.message, { status: 500 });

        return Response.json({ opportunities: inserted });
      },
    },
  },
});
