import { createFileRoute } from "@tanstack/react-router";
import { getUserIdFromRequest } from "@/lib/chat-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/account/data")({
  server: {
    handlers: {
      /**
       * Deletes a user's UGC-product data. Content sources/chunks/agents
       * cascade via ON DELETE CASCADE once the auth.users row itself is
       * removed - this endpoint deletes the auth user, which is the only
       * safe single point that guarantees every ugc_* table referencing
       * them is cleaned up consistently.
       */
      DELETE: async ({ request }) => {
        const userId = await getUserIdFromRequest(request);
        if (!userId) return new Response("Unauthorized", { status: 401 });

        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (error) return new Response(error.message, { status: 500 });

        return Response.json({ ok: true });
      },
    },
  },
});
