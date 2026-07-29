/**
 * Retired creator-outreach webhook.
 *
 * Resend is reserved for MatchAI product/transactional email. The creator
 * email delivery and synchronization provider has not been selected, so
 * accepting inbound creator mail here would create a false provider state.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/resend-inbound")({
  server: {
    handlers: {
      POST: async () =>
        Response.json(
          {
            ok: false,
            code: "creator_email_provider_not_configured",
            error: "Creator email inbound synchronization is not configured.",
          },
          { status: 410 },
        ),
    },
  },
});
