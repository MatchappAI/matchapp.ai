import { createFileRoute } from "@tanstack/react-router";
import { getUserIdFromRequest } from "@/lib/chat-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/content/import-url")({
  server: {
    handlers: {
      /**
       * Queues a public URL for ingestion (a public post/profile page, not
       * an authenticated scrape) - the actual fetch/parse happens in a
       * ugc_jobs worker, not inline in the request.
       */
      POST: async ({ request }) => {
        const creatorId = await getUserIdFromRequest(request);
        if (!creatorId) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json()) as { url: string };
        if (!body.url) return new Response("url required", { status: 400 });

        const { data: source, error: insertError } = await supabaseAdmin
          .from("ugc_content_sources")
          .insert({ creator_id: creatorId, type: "url", url: body.url, status: "pending" })
          .select("id")
          .single();
        if (insertError || !source) {
          return new Response(insertError?.message ?? "failed to create content source", { status: 500 });
        }

        await supabaseAdmin
          .from("ugc_jobs")
          .insert({ type: "ingest_url", payload_json: { sourceId: source.id, url: body.url } });

        return Response.json({ sourceId: source.id, status: "queued" });
      },
    },
  },
});
