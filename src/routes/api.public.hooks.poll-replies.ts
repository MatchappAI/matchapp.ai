/**
 * Legacy cron compatibility route.
 *
 * Creator communication now uses the authoritative MatchAI Inbox. No
 * delivery/synchronization provider has been selected, so this route must not
 * fabricate a successful synchronization pass.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/poll-replies")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const presented = request.headers.get("x-cron-secret") ?? "";
        const { data: secretRow } = await supabaseAdmin
          .from("cron_secret" as never)
          .select("secret")
          .eq("id", true)
          .maybeSingle();
        const expected = (secretRow as { secret?: string } | null)?.secret ?? "";
        if (!expected || presented.length !== expected.length || presented !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        return new Response(
          JSON.stringify({
            ok: false,
            scanned: 0,
            detected: 0,
            error: "creator-email-provider-not-configured",
          }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
