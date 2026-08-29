import { createFileRoute } from "@tanstack/react-router";
import { getUserIdFromRequest } from "@/lib/chat-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/feedback")({
  server: {
    handlers: {
      /** Creator or follower feedback on one agent message. */
      POST: async ({ request }) => {
        const userId = await getUserIdFromRequest(request);
        if (!userId) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json()) as {
          agentId: string;
          messageId?: string;
          rating?: number;
          correctionText?: string;
          asCreator: boolean;
        };
        if (!body.agentId) return new Response("agentId required", { status: 400 });

        const { error } = await supabaseAdmin.from("ugc_feedback").insert({
          agent_id: body.agentId,
          message_id: body.messageId ?? null,
          creator_id: body.asCreator ? userId : null,
          follower_id: body.asCreator ? null : userId,
          rating: body.rating ?? null,
          correction_text: body.correctionText ?? null,
        });
        if (error) return new Response(error.message, { status: 500 });

        return Response.json({ ok: true });
      },
    },
  },
});
