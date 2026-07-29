import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FEEDBACK_TYPES = ["icp", "painpoint", "feature_request", "desire", "feedback", "pricing", "sentiment"] as const;

/** Log a usage event (page view, click, action). Safe to call frequently. */
export const logUsageEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { event: string; route?: string; properties?: Record<string, unknown> }) =>
    z.object({
      event: z.string().min(1).max(120),
      route: z.string().max(300).optional(),
      properties: z.record(z.string(), z.unknown()).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("usage_events").insert({
      user_id: userId,
      event_name: data.event,
      route: data.route ?? null,
      properties: (data.properties ?? {}) as never,
    });
    return { ok: true };
  });


/** Capture qualitative feedback (ICP, painpoint, feature request, pricing, etc.). */
export const logProductFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    type: typeof FEEDBACK_TYPES[number];
    content: string;
    sentiment?: number;
    source?: string;
    route?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }) =>
    z.object({
      type: z.enum(FEEDBACK_TYPES),
      content: z.string().min(1).max(4000),
      sentiment: z.number().int().min(-2).max(2).optional(),
      source: z.string().max(60).optional(),
      route: z.string().max(300).optional(),
      tags: z.array(z.string().max(40)).max(20).optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("product_feedback").insert({
      user_id: userId,
      type: data.type,
      content: data.content,
      sentiment: data.sentiment ?? null,
      source: data.source ?? "user",
      route: data.route ?? null,
      tags: data.tags ?? [],
      metadata: (data.metadata ?? {}) as never,
    });
    return { ok: true };
  });


/** Capture pricing preferences (saas / outcome-based / hybrid + willingness to pay). */
export const logPricingSignal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    modelPreference?: "saas" | "outcome" | "hybrid" | "freemium";
    willingnessToPayCents?: number;
    billingCadence?: "monthly" | "annual" | "per_deal" | "per_outcome";
    rationale?: string;
    context?: Record<string, unknown>;
  }) =>
    z.object({
      modelPreference: z.enum(["saas", "outcome", "hybrid", "freemium"]).optional(),
      willingnessToPayCents: z.number().int().min(0).max(10_000_00).optional(),
      billingCadence: z.enum(["monthly", "annual", "per_deal", "per_outcome"]).optional(),
      rationale: z.string().max(2000).optional(),
      context: z.record(z.string(), z.unknown()).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("pricing_signals").insert({
      user_id: userId,
      model_preference: data.modelPreference ?? null,
      willingness_to_pay_cents: data.willingnessToPayCents ?? null,
      billing_cadence: data.billingCadence ?? null,
      rationale: data.rationale ?? null,
      context: (data.context ?? {}) as never,
    });
    return { ok: true };
  });


/** Owner/admin check for the current user. */
export const getMyRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = (data ?? []).map((r) => r.role as string);
    return {
      roles,
      isStaff: roles.includes("owner") || roles.includes("admin"),
      isOwner: roles.includes("owner"),
    };
  });

/** Admin-only: aggregated product intelligence for the insights panel. */
export const getInsightsSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { days?: number } | undefined) =>
    z.object({ days: z.number().int().min(1).max(365).default(30) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Gate: staff only (read own roles via user-scoped client — RLS allows that)
    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = (roleRows ?? []).map((r) => r.role as string);
    if (!roles.includes("owner") && !roles.includes("admin")) {
      throw new Error("Forbidden");
    }

    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();

    // Cross-user aggregates must bypass RLS — use the service-role client so
    // the admin sees every user's data, not just their own.
    const [events, feedback, pricing, profiles, creators, deals] = await Promise.all([
      supabaseAdmin.from("usage_events").select("event_name,route,user_id,created_at").gte("created_at", since),
      supabaseAdmin.from("product_feedback").select("*").gte("created_at", since).order("created_at", { ascending: false }),
      supabaseAdmin.from("pricing_signals").select("*").gte("created_at", since),
      supabaseAdmin.from("profiles").select("user_id,plan,created_at,onboarding_complete"),
      supabaseAdmin.from("creator_profiles").select("user_id,niche,location,follower_count"),
      supabaseAdmin.from("deals").select("user_id,deal_value,status,invoice_status,created_at").gte("created_at", since),
    ]);


    const ev = events.data ?? [];
    const fb = feedback.data ?? [];
    const ps = pricing.data ?? [];
    const pf = profiles.data ?? [];
    const cp = creators.data ?? [];
    const dl = deals.data ?? [];

    const followerTier = (n: number | null | undefined) => {
      const v = Number(n ?? 0);
      if (v >= 1_000_000) return "1M+";
      if (v >= 100_000) return "100K–1M";
      if (v >= 10_000) return "10K–100K";
      if (v >= 1_000) return "1K–10K";
      return "<1K";
    };
    const creatorByUser = new Map(cp.map((c) => [c.user_id, c]));


    // Usage: top events + top routes + DAU/WAU
    const eventCount: Record<string, number> = {};
    const routeCount: Record<string, number> = {};
    const dayUsers: Record<string, Set<string>> = {};
    for (const e of ev) {
      eventCount[e.event_name] = (eventCount[e.event_name] ?? 0) + 1;
      if (e.route) routeCount[e.route] = (routeCount[e.route] ?? 0) + 1;
      const day = String(e.created_at).slice(0, 10);
      if (!dayUsers[day]) dayUsers[day] = new Set();
      if (e.user_id) dayUsers[day].add(e.user_id);
    }
    const topEvents = Object.entries(eventCount).sort((a, b) => b[1] - a[1]).slice(0, 12);
    const topRoutes = Object.entries(routeCount).sort((a, b) => b[1] - a[1]).slice(0, 12);
    const dailyActive = Object.entries(dayUsers)
      .map(([d, s]) => ({ day: d, users: s.size }))
      .sort((a, b) => a.day.localeCompare(b.day));

    // ICP: niches + follower tiers + locations weighted by paid deals
    const userValue: Record<string, number> = {};
    for (const d of dl) {
      if (!d.user_id) continue;
      const val = d.invoice_status === "paid" ? Number(d.deal_value ?? 0) : 0;
      userValue[d.user_id] = (userValue[d.user_id] ?? 0) + val;
    }
    const groupBy = (key: "niche" | "follower_tier" | "location") => {
      const counts: Record<string, { users: number; revenue: number }> = {};
      for (const p of pf) {
        const c = creatorByUser.get(p.user_id);
        let k: string | null = null;
        if (key === "niche") k = c?.niche ?? null;
        else if (key === "location") k = c?.location ?? null;
        else k = followerTier(c?.follower_count);
        if (!k) continue;
        if (!counts[k]) counts[k] = { users: 0, revenue: 0 };
        counts[k].users += 1;
        counts[k].revenue += userValue[p.user_id] ?? 0;
      }
      return Object.entries(counts)
        .map(([k, v]) => ({ key: k, ...v }))
        .sort((a, b) => b.revenue - a.revenue || b.users - a.users)
        .slice(0, 10);
    };

    const icp = {
      byNiche: groupBy("niche"),
      byFollowerTier: groupBy("follower_tier"),
      byLocation: groupBy("location"),
    };

    // Feedback: bucket by type
    const byType: Record<string, typeof fb> = {};
    for (const f of fb) {
      const t = f.type as string;
      if (!byType[t]) byType[t] = [];
      byType[t].push(f);
    }
    const feedbackBuckets = Object.entries(byType).map(([type, items]) => ({
      type,
      count: items.length,
      recent: items.slice(0, 8).map((i) => ({
        id: i.id,
        content: i.content,
        sentiment: i.sentiment,
        source: i.source,
        route: i.route,
        tags: i.tags,
        created_at: i.created_at,
      })),
    }));

    // Pricing: model preference + median willingness
    const modelCounts: Record<string, number> = {};
    const cadenceCounts: Record<string, number> = {};
    const willingness: number[] = [];
    for (const p of ps) {
      if (p.model_preference) modelCounts[p.model_preference] = (modelCounts[p.model_preference] ?? 0) + 1;
      if (p.billing_cadence) cadenceCounts[p.billing_cadence] = (cadenceCounts[p.billing_cadence] ?? 0) + 1;
      if (p.willingness_to_pay_cents != null) willingness.push(p.willingness_to_pay_cents);
    }
    willingness.sort((a, b) => a - b);
    const median = willingness.length ? willingness[Math.floor(willingness.length / 2)] : null;
    const p25 = willingness.length ? willingness[Math.floor(willingness.length * 0.25)] : null;
    const p75 = willingness.length ? willingness[Math.floor(willingness.length * 0.75)] : null;

    return {
      windowDays: data.days,
      totals: {
        users: pf.length,
        activatedUsers: pf.filter((p) => p.onboarding_complete).length,
        events: ev.length,
        feedbackItems: fb.length,
        pricingSignals: ps.length,
        paidDeals: dl.filter((d) => d.invoice_status === "paid").length,
        revenueCents: dl
          .filter((d) => d.invoice_status === "paid")
          .reduce((s, d) => s + Math.round(Number(d.deal_value ?? 0) * 100), 0),
      },
      usage: { topEvents, topRoutes, dailyActive },
      icp,
      feedback: feedbackBuckets,
      pricing: {
        modelCounts,
        cadenceCounts,
        willingness: { median, p25, p75, samples: willingness.length },
      },
    };
  });
