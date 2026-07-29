/**
 * Email open tracking pixel.
 * GET /api/public/email/open/<tracking_id>.gif → 1x1 transparent GIF.
 * Increments outreach_emails.open_count and stamps first_opened_at.
 */
import { createFileRoute } from "@tanstack/react-router";

// 43-byte 1x1 transparent GIF (base64)
const PIXEL_B64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const PIXEL_BYTES = Uint8Array.from(atob(PIXEL_B64), (c) => c.charCodeAt(0));

function pixelResponse() {
  return new Response(PIXEL_BYTES, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Content-Length": String(PIXEL_BYTES.byteLength),
    },
  });
}

export const Route = createFileRoute("/api/public/email/open/$tid")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const raw = params.tid ?? "";
        const id = raw.replace(/\.gif$/i, "");
        if (!/^[0-9a-f-]{36}$/i.test(id)) return pixelResponse();
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: row } = await supabaseAdmin
            .from("outreach_emails")
            .select("id, open_count, first_opened_at")
            .eq("tracking_id", id)
            .maybeSingle();
          if (row) {
            await supabaseAdmin
              .from("outreach_emails")
              .update({
                opened: true,
                open_count: (row.open_count ?? 0) + 1,
                first_opened_at: row.first_opened_at ?? new Date().toISOString(),
              })
              .eq("id", row.id);
          }
        } catch (err) {
          console.error("[email-open] tracking error", err);
        }
        return pixelResponse();
      },
    },
  },
});
