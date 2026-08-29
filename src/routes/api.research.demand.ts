import { createFileRoute } from "@tanstack/react-router";
import { generateObject } from "ai";
import { z } from "zod";
import { getUserIdFromRequest } from "@/lib/chat-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getModel } from "@/lib/ai-provider.server";

const DemandSummarySchema = z.object({
  themes: z.array(z.object({ theme: z.string(), evidence: z.string() })),
  sourceLinks: z.array(z.string()),
});

export const Route = createFileRoute("/api/research/demand")({
  server: {
    handlers: {
      /** Runs Reddit demand research for a creator's niche and stores distilled themes. */
      POST: async ({ request }) => {
        const creatorId = await getUserIdFromRequest(request);
        if (!creatorId) return new Response("Unauthorized", { status: 401 });

        const { data: profile } = await supabaseAdmin
          .from("ugc_creator_profiles")
          .select("niche")
          .eq("user_id", creatorId)
          .maybeSingle();

        const niche = profile?.niche;
        if (!niche) return new Response("run /api/creator/analyze first to establish a niche", { status: 400 });

        const searchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(niche)}&sort=relevance&limit=25`;
        const redditResponse = await fetch(searchUrl, { headers: { "User-Agent": "matchai-demand-research/1.0" } });
        if (!redditResponse.ok) {
          return new Response(`reddit search failed: ${redditResponse.status}`, { status: 502 });
        }
        const redditJson = (await redditResponse.json()) as {
          data: { children: Array<{ data: { title: string; selftext: string; permalink: string } }> };
        };

        const posts = redditJson.data.children.map((c) => ({
          title: c.data.title,
          body: c.data.selftext?.slice(0, 500) ?? "",
          link: `https://reddit.com${c.data.permalink}`,
        }));

        const { object } = await generateObject({
          model: getModel("extraction"),
          schema: DemandSummarySchema,
          prompt: `These are public Reddit posts about "${niche}". Distill the recurring pain points/desires (themes) people express, with one representative piece of evidence per theme, and list the source links used.\n\n${JSON.stringify(posts)}`,
        });

        await supabaseAdmin.from("ugc_demand_research_runs").insert({
          creator_id: creatorId,
          niche,
          query_set_json: [niche],
          summary_json: object.themes,
          source_links_json: object.sourceLinks,
        });

        return Response.json(object);
      },
    },
  },
});
