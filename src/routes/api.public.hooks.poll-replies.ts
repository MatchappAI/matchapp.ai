/**
 * Reply polling is a no-op now that outreach sends exclusively through
 * MatchAI's verified Resend domain. Brand replies land back at
 * outreach@notify.www.matchapp.ai and are ingested via the Resend inbound
 * webhook (handled elsewhere) — there's no external mailbox to poll.
 *
 * The endpoint is kept so any existing pg_cron schedule keeps returning 200
 * instead of erroring; it does nothing on its own.
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
          JSON.stringify({ ok: true, scanned: 0, detected: 0, note: "gmail-poll-disabled" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
