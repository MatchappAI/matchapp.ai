/**
 * Daily digest — sends each active creator an 8am summary of what MatchAI did
 * for them in the last 24h, plus their next best step. Triggered by pg_cron.
 *
 * Auth: pg_cron passes the Supabase publishable/anon key in the apikey header;
 * we verify it matches SUPABASE_PUBLISHABLE_KEY before doing any work.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const SENDER = "MatchAI <hello@notify.www.matchapp.ai>";
const SITE = "https://www.matchapp.ai";

type OvernightRow = {
  kind: "match" | "sent" | "opened" | "replied" | "closed";
  title: string;
  detail: string;
};

function buildHtml(opts: {
  firstName: string;
  overnight: OvernightRow[];
  nextLabel: string;
  nextHint: string;
  nextRoute: string;
  overallPct: number;
}) {
  const { firstName, overnight, nextLabel, nextHint, nextRoute, overallPct } = opts;
  const items = overnight
    .slice(0, 6)
    .map(
      (o) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0eef5;">
          <div style="font:600 14px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1424;">${escapeHtml(o.title)}</div>
          <div style="font:14px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#6b6478;margin-top:2px;">${escapeHtml(o.detail)}</div>
        </td>
      </tr>`,
    )
    .join("");

  const overnightBlock =
    overnight.length === 0
      ? `<p style="font:15px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#6b6478;margin:0 0 20px;">Quiet last 24 hours — I'm still working. New matches usually land within 24–48h.</p>`
      : `<table style="width:100%;border-collapse:collapse;margin:0 0 20px;">${items}</table>`;

  return `<!doctype html>
<html><body style="margin:0;background:#faf8ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="font:600 13px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#7c3aed;letter-spacing:0.04em;text-transform:uppercase;">MatchAI · daily</div>
    <h1 style="font:700 22px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1424;margin:6px 0 4px;">morning ${escapeHtml(firstName)} — here's what i did</h1>
    <p style="font:14px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#6b6478;margin:0 0 20px;">last 24 hours · journey ${overallPct}% to first paid deal</p>

    ${overnightBlock}

    <div style="background:#f3efff;border:1px solid #e4dbff;border-radius:14px;padding:16px 18px;margin:0 0 20px;">
      <div style="font:600 13px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#7c3aed;text-transform:uppercase;letter-spacing:0.04em;">up next</div>
      <div style="font:600 16px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1424;margin:4px 0 2px;">${escapeHtml(nextLabel)}</div>
      <div style="font:14px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#5a5368;margin-bottom:12px;">${escapeHtml(nextHint)}</div>
      <a href="${SITE}${nextRoute}" style="display:inline-block;background:#1a1424;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font:600 14px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">open matchai →</a>
    </div>

    <p style="font:12px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#9992a5;margin:24px 0 0;">You're getting this because MatchAI is actively working on your deals. <a href="${SITE}/dashboard/settings" style="color:#9992a5;">Turn off daily updates</a>.</p>
  </div>
</body></html>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const Route = createFileRoute("/api/public/hooks/daily-digest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        const provided =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!expected || provided !== expected) {
          return new Response("unauthorized", { status: 401 });
        }

        const supabaseUrl = process.env.SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const resendKey = process.env.RESEND_API_KEY;
        if (!supabaseUrl || !serviceKey || !resendKey) {
          return Response.json({ error: "not configured" }, { status: 500 });
        }

        const admin = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // Active creators = have finished onboarding OR at least one brand match
        const { data: profiles } = await admin
          .from("profiles")
          .select(
            "user_id, email, full_name, display_name, onboarding_complete, creator_handle, notification_prefs",
          )
          .not("email", "is", null)
          .limit(1000);

        let sent = 0;
        let skipped = 0;

        for (const p of profiles ?? []) {
          const prefs = (p.notification_prefs ?? {}) as Record<string, unknown>;
          if (prefs.daily_digest === false) {
            skipped++;
            continue;
          }

          const userId = p.user_id;
          const [matchesR, draftsR, sentR, openedR, repliedR, closedR, recentR] =
            await Promise.all([
              admin.from("brand_matches").select("id", { count: "exact", head: true }).eq("user_id", userId),
              admin.from("outreach_emails").select("id", { count: "exact", head: true }).eq("user_id", userId),
              admin.from("outreach_emails").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("sent", true),
              admin.from("outreach_emails").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("opened", true),
              admin.from("outreach_emails").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("replied", true),
              admin.from("deals").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("invoice_status", "paid"),
              Promise.all([
                admin.from("brand_matches").select("brand_name, fit_score, created_at").eq("user_id", userId).gte("created_at", since).order("created_at", { ascending: false }).limit(4),
                admin.from("outreach_emails").select("subject, sent_at, first_opened_at, replied, opened, sent, open_count").eq("user_id", userId).or(`sent_at.gte.${since},first_opened_at.gte.${since}`).order("sent_at", { ascending: false }).limit(6),
                admin.from("deals").select("brand_name, deal_value, updated_at").eq("user_id", userId).eq("invoice_status", "paid").gte("updated_at", since).limit(3),
              ]),
            ]);

          const [recentMatches, recentEmails, recentPaid] = recentR;

          const overnight: OvernightRow[] = [];
          for (const m of recentMatches.data ?? []) {
            overnight.push({
              kind: "match",
              title: `new match: ${m.brand_name}`,
              detail: `${m.fit_score ?? "—"}% fit — worth a look`,
            });
          }
          for (const e of recentEmails.data ?? []) {
            if (e.replied) {
              overnight.push({ kind: "replied", title: `brand replied: ${e.subject}`, detail: "i drafted a response — needs your approval" });
            } else if (e.opened) {
              overnight.push({ kind: "opened", title: `brand opened: ${e.subject}`, detail: (e.open_count ?? 1) > 1 ? `opened ${e.open_count}× — hot signal` : "first open — good sign" });
            } else if (e.sent) {
              overnight.push({ kind: "sent", title: `pitch sent: ${e.subject}`, detail: "waiting for the brand to open" });
            }
          }
          for (const d of recentPaid.data ?? []) {
            overnight.push({ kind: "closed", title: `deal paid: ${d.brand_name}`, detail: `$${Number(d.deal_value ?? 0).toLocaleString()} released` });
          }

          const matches = matchesR.count ?? 0;
          const drafts = draftsR.count ?? 0;
          const sentCount = sentR.count ?? 0;
          const opened = openedR.count ?? 0;
          const replied = repliedR.count ?? 0;
          const closed = closedR.count ?? 0;
          const setupDone = !!(p.onboarding_complete && p.creator_handle);

          // Skip completely inactive users (no matches AND no setup) to avoid spam.
          if (!setupDone && matches === 0) {
            skipped++;
            continue;
          }
          // Skip users with zero overnight activity AND already past first paid deal.
          if (overnight.length === 0 && closed > 0) {
            skipped++;
            continue;
          }

          const flags = [setupDone, matches > 0, drafts > 0, sentCount > 0, opened > 0, replied > 0, closed > 0];
          const doneCount = flags.filter(Boolean).length;
          const overallPct = Math.round((doneCount / flags.length) * 100);

          let nextLabel = "finish setup";
          let nextHint = "so i can pitch as you";
          let nextRoute = "/dashboard/settings";
          if (!setupDone) {
            // default
          } else if (matches === 0) {
            nextLabel = "brand matches incoming"; nextHint = "i'm scanning — first matches within 24h"; nextRoute = "/dashboard/brands";
          } else if (drafts === 0) {
            nextLabel = "approve your first pitch"; nextHint = "one tap to draft"; nextRoute = "/dashboard/brands";
          } else if (sentCount === 0) {
            nextLabel = "send your first pitch"; nextHint = "one tap and it's out"; nextRoute = "/dashboard/approvals";
          } else if (replied === 0) {
            nextLabel = "waiting on replies"; nextHint = opened > 0 ? `${opened} brand${opened === 1 ? "" : "s"} opened — reply usually lands in 4–7 days` : "opens usually land day 1–2"; nextRoute = "/dashboard/approvals";
          } else if (closed === 0) {
            nextLabel = "close your first deal"; nextHint = "i drafted responses — needs your approval"; nextRoute = "/dashboard/approvals";
          } else {
            nextLabel = "keep the momentum"; nextHint = "another paid deal is close"; nextRoute = "/dashboard/brands";
          }

          const firstName =
            ((p.display_name ?? p.full_name ?? "").split(" ")[0] ?? "").trim().toLowerCase() ||
            "there";
          const html = buildHtml({ firstName, overnight, nextLabel, nextHint, nextRoute, overallPct });
          const subject =
            overnight.length === 0
              ? `MatchAI — up next: ${nextLabel}`
              : `MatchAI — ${overnight.length} update${overnight.length === 1 ? "" : "s"} overnight`;

          try {
            const res = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
              body: JSON.stringify({
                from: SENDER,
                to: [p.email],
                subject,
                html,
                tags: [{ name: "type", value: "daily_digest" }],
              }),
            });
            if (res.ok) sent++;
            else {
              skipped++;
              console.error("[daily-digest] resend failed", res.status, await res.text().catch(() => ""));
            }
          } catch (err) {
            skipped++;
            console.error("[daily-digest] send error", err);
          }
        }

        return Response.json({ ok: true, sent, skipped, total: profiles?.length ?? 0 });
      },
    },
  },
});
