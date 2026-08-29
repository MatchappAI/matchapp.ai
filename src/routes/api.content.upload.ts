import { createFileRoute } from "@tanstack/react-router";
import { getUserIdFromRequest } from "@/lib/chat-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CONTENT_BUCKET = "ugc-content";

export const Route = createFileRoute("/api/content/upload")({
  server: {
    handlers: {
      /** Creates a content_source row and a signed upload URL for its file. */
      POST: async ({ request }) => {
        const creatorId = await getUserIdFromRequest(request);
        if (!creatorId) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json()) as { type: "video" | "post" | "pdf" | "other"; fileName: string };
        if (!body.fileName) return new Response("fileName required", { status: 400 });

        const path = `${creatorId}/${Date.now()}-${body.fileName}`;

        const { data: source, error: insertError } = await supabaseAdmin
          .from("ugc_content_sources")
          .insert({ creator_id: creatorId, type: body.type, storage_path: path, status: "pending" })
          .select("id")
          .single();
        if (insertError || !source) {
          return new Response(insertError?.message ?? "failed to create content source", { status: 500 });
        }

        const { data: signed, error: signError } = await supabaseAdmin.storage
          .from(CONTENT_BUCKET)
          .createSignedUploadUrl(path);
        if (signError || !signed) {
          return new Response(signError?.message ?? "failed to create signed upload URL", { status: 500 });
        }

        return Response.json({ sourceId: source.id, uploadUrl: signed.signedUrl, path: signed.path });
      },
    },
  },
});
