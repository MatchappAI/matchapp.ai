/**
 * Public cron health check. Uses existing side-effect tables as proxies for
 * the last successful run of each hook. Returns 200 when every job's most
 * recent evidence is fresh, 503 otherwise — safe to expose to uptime probes.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Probe = {
  name: string;
  staleAfterMinutes: number;
  check: () => Promise<string | null>;
};

async function latestInboundReply(): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("ai_replies")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.created_at ?? null;
}

async function latestOutreachSent(): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("outreach_emails")
    .select("sent_at")
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.sent_at ?? null;
}

const PROBES: Probe[] = [
  { name: "poll-replies", staleAfterMinutes: 60, check: latestInboundReply },
  { name: "process-follow-ups", staleAfterMinutes: 60 * 6, check: latestOutreachSent },
];

export const Route = createFileRoute("/api/public/hooks/health")({
  server: {
    handlers: {
      GET: async () => {
        const results: Array<{
          name: string;
          last_activity_at: string | null;
          ok: boolean;
          stale_minutes: number | null;
        }> = [];
        let overallOk = true;
        for (const p of PROBES) {
          let last: string | null = null;
          try {
            last = await p.check();
          } catch {
            last = null;
          }
          const staleMin = last ? (Date.now() - new Date(last).getTime()) / 60000 : null;
          // If we've never had activity, don't fail the probe (fresh workspace).
          const ok = staleMin === null ? true : staleMin <= p.staleAfterMinutes;
          if (!ok) overallOk = false;
          results.push({
            name: p.name,
            last_activity_at: last,
            ok,
            stale_minutes: staleMin === null ? null : Math.round(staleMin),
          });
        }
        return new Response(
          JSON.stringify(
            { ok: overallOk, hooks: results, checked_at: new Date().toISOString() },
            null,
            2,
          ),
          {
            status: overallOk ? 200 : 503,
            headers: { "content-type": "application/json" },
          },
        );
      },
    },
  },
});
