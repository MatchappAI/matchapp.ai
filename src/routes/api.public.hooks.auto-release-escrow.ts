/**
 * Retired legacy endpoint.
 *
 * MatchAI does not hold, release, or transfer creator-brand payments. Keep the
 * route temporarily so an old scheduler receives an explicit terminal response
 * instead of mutating dormant financial tables.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/auto-release-escrow")({
  server: {
    handlers: {
      POST: async () =>
        Response.json(
          {
            ok: false,
            retired: true,
            message:
              "Creator-brand payments are handled externally and are never released by MatchAI.",
          },
          { status: 410 },
        ),
    },
  },
});
