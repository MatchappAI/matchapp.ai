import { createFileRoute } from "@tanstack/react-router";
import { generateObject } from "ai";
import { z } from "zod";
import { getUserIdFromRequest } from "@/lib/chat-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getModel } from "@/lib/ai-provider.server";

const ProfileSchema = z.object({
  niche: z.string(),
  sub_niches: z.array(z.string()),
  extracted_tone: z.string(),
  expertise: z.array(z.string()),
  exclusions: z.array(z.string()).describe("topics/claims this creator should never make (e.g. medical advice)"),
});

export const Route = createFileRoute("/api/creator/analyze")({
  server: {
    handlers: {
      /** Generates a structured creator profile from their ready content sources. */
      POST: async ({ request }) => {
        const creatorId = await getUserIdFromRequest(request);
        if (!creatorId) return new Response("Unauthorized", { status: 401 });

        const { data: chunks } = await supabaseAdmin
          .from("ugc_content_chunks")
          .select("chunk_text")
          .eq("creator_id", creatorId)
          .limit(50);

        if (!chunks || chunks.length === 0) {
          return new Response("no ingested content yet - upload content first", { status: 400 });
        }

        const corpus = chunks.map((c) => c.chunk_text).join("\n\n").slice(0, 20000);

        const { object } = await generateObject({
          model: getModel("extraction"),
          schema: ProfileSchema,
          prompt: `Based only on this creator's own content, extract their niche, tone, and expertise. Never invent claims not supported by the text.\n\n${corpus}`,
        });

        const { error } = await supabaseAdmin.from("ugc_creator_profiles").upsert(
          {
            user_id: creatorId,
            niche: object.niche,
            sub_niches: object.sub_niches,
            extracted_tone: object.extracted_tone,
            expertise_json: object.expertise,
            exclusions_json: object.exclusions,
          },
          { onConflict: "user_id" },
        );
        if (error) return new Response(error.message, { status: 500 });

        return Response.json(object);
      },
    },
  },
});
