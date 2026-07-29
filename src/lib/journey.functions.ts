import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type JourneyStep = {
  key: "setup" | "matches" | "drafted" | "sent" | "opened" | "replied" | "closed";
  label: string;
  done: boolean;
  count: number;
  hint: string;
};

export type OvernightItem = {
  kind: "match" | "sent" | "opened" | "replied" | "closed";
  title: string;
  detail: string;
  at: string;
  route?: string;
};

export type JourneyStatus = {
  steps: JourneyStep[];
  currentStepIndex: number;
  overallPct: number;
  overnight: OvernightItem[];
  lastCheckedAt: string;
};

export const getJourneyStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<JourneyStatus> => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [
      profileR,
      matchesR,
      draftsR,
      sentR,
      openedR,
      repliedR,
      closedR,
      recentMatchesR,
      recentSentR,
      recentOpenedR,
      recentRepliedR,
      recentPaidR,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("onboarding_complete, onboarding_step, creator_handle, sender_email")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("brand_matches")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("outreach_emails")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("outreach_emails")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("sent", true),
      supabase
        .from("outreach_emails")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("opened", true),
      supabase
        .from("outreach_emails")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("replied", true),
      supabase
        .from("deals")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("invoice_status", "paid"),
      supabase
        .from("brand_matches")
        .select("id, brand_name, fit_score, created_at")
        .eq("user_id", userId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("outreach_emails")
        .select("id, subject, sent_at")
        .eq("user_id", userId)
        .eq("sent", true)
        .gte("sent_at", since)
        .order("sent_at", { ascending: false })
        .limit(6),
      supabase
        .from("outreach_emails")
        .select("id, subject, first_opened_at, open_count")
        .eq("user_id", userId)
        .eq("opened", true)
        .gte("first_opened_at", since)
        .order("first_opened_at", { ascending: false })
        .limit(6),
      supabase
        .from("outreach_emails")
        .select("id, subject, created_at")
        .eq("user_id", userId)
        .eq("replied", true)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("deals")
        .select("id, brand_name, deal_value, updated_at")
        .eq("user_id", userId)
        .eq("invoice_status", "paid")
        .gte("updated_at", since)
        .order("updated_at", { ascending: false })
        .limit(6),
    ]);

    const profile = profileR.data;
    const matches = matchesR.count ?? 0;
    const drafts = draftsR.count ?? 0;
    const sent = sentR.count ?? 0;
    const opened = openedR.count ?? 0;
    const replied = repliedR.count ?? 0;
    const closed = closedR.count ?? 0;

    const setupDone = !!(profile?.onboarding_complete && profile?.creator_handle);

    const steps: JourneyStep[] = [
      {
        key: "setup",
        label: "Setup",
        done: setupDone,
        count: setupDone ? 1 : 0,
        hint: setupDone ? "profile ready" : "finish so MatchAI can pitch as you",
      },
      {
        key: "matches",
        label: "Brand matches",
        done: matches > 0,
        count: matches,
        hint: matches > 0 ? `${matches} matched` : "MatchAI is scanning brands",
      },
      {
        key: "drafted",
        label: "First pitch drafted",
        done: drafts > 0,
        count: drafts,
        hint: drafts > 0 ? `${drafts} drafts ready` : "approve a match to draft",
      },
      {
        key: "sent",
        label: "First pitch sent",
        done: sent > 0,
        count: sent,
        hint: sent > 0 ? `${sent} sent` : "one tap to send",
      },
      {
        key: "opened",
        label: "Brand opened",
        done: opened > 0,
        count: opened,
        hint: opened > 0 ? `${opened} opened` : "typical avg: day 1–2",
      },
      {
        key: "replied",
        label: "Brand replied",
        done: replied > 0,
        count: replied,
        hint: replied > 0 ? `${replied} replies` : "typical avg: day 4–7",
      },
      {
        key: "closed",
        label: "First deal paid",
        done: closed > 0,
        count: closed,
        hint: closed > 0 ? `${closed} paid` : "external payment on close",
      },
    ];

    const doneCount = steps.filter((s) => s.done).length;
    const currentStepIndex = Math.min(doneCount, steps.length - 1);
    const overallPct = Math.round((doneCount / steps.length) * 100);

    const overnight: OvernightItem[] = [];
    for (const m of recentMatchesR.data ?? []) {
      overnight.push({
        kind: "match",
        title: `New brand match: ${m.brand_name}`,
        detail: `${m.fit_score ?? "—"}% fit — worth a look`,
        at: m.created_at as string,
        route: "/dashboard/brands",
      });
    }
    for (const e of recentSentR.data ?? []) {
      overnight.push({
        kind: "sent",
        title: `Pitch sent: ${e.subject}`,
        detail: "waiting for the brand to open",
        at: (e.sent_at ?? new Date().toISOString()) as string,
        route: "/dashboard/approvals",
      });
    }
    for (const e of recentOpenedR.data ?? []) {
      overnight.push({
        kind: "opened",
        title: `Brand opened: ${e.subject}`,
        detail:
          (e.open_count ?? 1) > 1
            ? `opened ${e.open_count} times — hot signal`
            : "first open — good sign",
        at: (e.first_opened_at ?? new Date().toISOString()) as string,
        route: "/dashboard/approvals",
      });
    }
    for (const e of recentRepliedR.data ?? []) {
      overnight.push({
        kind: "replied",
        title: `Brand replied: ${e.subject}`,
        detail: "MatchAI drafted a response — needs your approval",
        at: (e.created_at ?? new Date().toISOString()) as string,
        route: "/dashboard/approvals",
      });
    }
    for (const d of recentPaidR.data ?? []) {
      overnight.push({
        kind: "closed",
        title: `Deal paid: ${d.brand_name}`,
        detail: `$${Number(d.deal_value ?? 0).toLocaleString()} released`,
        at: (d.updated_at ?? new Date().toISOString()) as string,
        route: "/dashboard/tracker",
      });
    }
    overnight.sort((a, b) => (a.at < b.at ? 1 : -1));

    return {
      steps,
      currentStepIndex,
      overallPct,
      overnight: overnight.slice(0, 8),
      lastCheckedAt: new Date().toISOString(),
    };
  });
