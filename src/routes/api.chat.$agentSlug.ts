import { createFileRoute } from "@tanstack/react-router";
import { streamText, embed, convertToModelMessages, type UIMessage } from "ai";
import { getUserIdFromRequest } from "@/lib/chat-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getModel, getEmbeddingModel } from "@/lib/ai-provider.server";

export const Route = createFileRoute("/api/chat/$agentSlug")({
  server: {
    handlers: {
      /** Follower chat: entitlement check, retrieval, memory, usage logging. */
      POST: async ({ request, params }) => {
        const followerId = await getUserIdFromRequest(request);
        if (!followerId) return new Response("Unauthorized", { status: 401 });

        const { data: agent } = await supabaseAdmin
          .from("ugc_agents")
          .select("*")
          .eq("slug", params.agentSlug)
          .eq("published", true)
          .maybeSingle();
        if (!agent) return new Response("agent not found", { status: 404 });

        const { data: customer } = await supabaseAdmin
          .from("ugc_agent_customers")
          .select("entitlement_status")
          .eq("agent_id", agent.id)
          .eq("follower_id", followerId)
          .maybeSingle();
        const entitled = customer && ["trial", "active"].includes(customer.entitlement_status);
        if (!entitled) {
          return new Response("not entitled - checkout required", { status: 402 });
        }

        const body = (await request.json()) as { messages: UIMessage[] };
        const latestUserText =
          body.messages
            .filter((m) => m.role === "user")
            .at(-1)
            ?.parts?.map((p) => ("text" in p ? p.text : ""))
            .join(" ") ?? "";

        const [{ data: conversation }, { embedding }] = await Promise.all([
          supabaseAdmin
            .from("ugc_conversations")
            .upsert(
              { agent_id: agent.id, follower_id: followerId, last_active_at: new Date().toISOString() },
              { onConflict: "agent_id,follower_id" },
            )
            .select("id")
            .single(),
          embed({ model: getEmbeddingModel(), value: latestUserText }),
        ]);

        const { data: retrieved } = await supabaseAdmin.rpc("match_ugc_content_chunks", {
          p_creator_id: agent.creator_id,
          p_query_embedding: embedding,
          p_match_count: 6,
        });
        const groundingText = (retrieved ?? []).map((r: { chunk_text: string }) => r.chunk_text).join("\n---\n");

        const { data: memoryRow } = await supabaseAdmin
          .from("ugc_follower_memory")
          .select("memory_json")
          .eq("agent_id", agent.id)
          .eq("follower_id", followerId)
          .maybeSingle();

        const result = streamText({
          model: getModel("chat"),
          system: `${agent.system_prompt}\n\nGround every answer in the creator's own content below - never invent claims outside it, never offer medical/financial/legal advice unless the creator's content explicitly covers it, never role-play as the creator's voice/likeness.\n\nCreator content:\n${groundingText}\n\nWhat you remember about this follower: ${JSON.stringify(memoryRow?.memory_json ?? {})}`,
          messages: convertToModelMessages(body.messages),
          onFinish: async ({ usage, text }) => {
            if (conversation) {
              await supabaseAdmin.from("ugc_messages").insert([
                { conversation_id: conversation.id, role: "user", content: latestUserText },
                {
                  conversation_id: conversation.id,
                  role: "assistant",
                  content: text,
                  token_usage: usage.totalTokens,
                },
              ]);
            }
          },
        });

        return result.toUIMessageStreamResponse();
      },
    },
  },
});
