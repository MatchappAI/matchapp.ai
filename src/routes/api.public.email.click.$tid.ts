/**
 * Email click tracking redirect.
 * GET /api/public/email/click/<tracking_id>?u=<target> → 302 to target.
 * Increments outreach_emails.click_count and stamps last_clicked_at.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/email/click/$tid")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const id = (params.tid ?? "").trim();
        const url = new URL(request.url);
        const target = url.searchParams.get("u") ?? "";

        let safeTarget = "https://www.matchapp.ai";
        try {
          const parsed = new URL(target);
          if (parsed.protocol === "http:" || parsed.protocol === "https:") {
            safeTarget = parsed.toString();
          }
        } catch {
          /* fall through */
        }

        if (/^[0-9a-f-]{36}$/i.test(id)) {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { data: row } = await supabaseAdmin
              .from("outreach_emails")
              .select("id, click_count")
              .eq("tracking_id", id)
              .maybeSingle();
            if (row) {
              await supabaseAdmin
                .from("outreach_emails")
                .update({
                  click_count: (row.click_count ?? 0) + 1,
                  last_clicked_at: new Date().toISOString(),
                })
                .eq("id", row.id);
            }
          } catch (err) {
            console.error("[email-click] tracking error", err);
          }
        }

        return new Response(null, {
          status: 302,
          headers: { Location: safeTarget, "Cache-Control": "no-store" },
        });
      },
    },
  },
});
