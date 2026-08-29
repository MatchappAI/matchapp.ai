import { createFileRoute } from "@tanstack/react-router";
import { getUserIdFromRequest } from "@/lib/chat-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { TablesUpdate } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/agents/$id")({
  server: {
    handlers: {
      /** Updates an agent's settings/pricing/safety - never touches safety_json's clone flags. */
      PATCH: async ({ request, params }) => {
        const creatorId = await getUserIdFromRequest(request);
        if (!creatorId) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json()) as Partial<{
          name: string;
          description: string;
          systemPrompt: string;
          priceModel: "subscription" | "one_time";
          priceCents: number;
          freeQuota: number;
          published: boolean;
        }>;

        const update: TablesUpdate<"ugc_agents"> = {};
        if (body.name !== undefined) update.name = body.name;
        if (body.description !== undefined) update.description = body.description;
        if (body.systemPrompt !== undefined) update.system_prompt = body.systemPrompt;
        if (body.priceModel !== undefined) update.price_model = body.priceModel;
        if (body.priceCents !== undefined) update.price_cents = body.priceCents;
        if (body.freeQuota !== undefined) update.free_quota = body.freeQuota;
        if (body.published !== undefined) update.published = body.published;

        const { data, error } = await supabaseAdmin
          .from("ugc_agents")
          .update(update)
          .eq("id", params.id)
          .eq("creator_id", creatorId)
          .select("*")
          .single();

        if (error) return new Response(error.message, { status: 500 });
        if (!data) return new Response("not found", { status: 404 });
        return Response.json({ agent: data });
      },
    },
  },
});
