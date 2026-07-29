import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { startActorRun, getRunStatus, fetchDatasetItems } from "@/lib/apify.server";

/**
 * Aggregate stats for the /dashboard Home page.
 * Returns counts + monetary sums computed from the user's tables.
 */
export const getHomeStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [
      deals,
      brandMatches,
      approvals,
    ] = await Promise.all([
      supabase.from("deals").select("id,deal_value,status,escrow_status,invoice_status").eq("user_id", userId),
      supabase.from("brand_matches").select("id,status,estimated_deal_max").eq("user_id", userId),
      supabase.from("approvals").select("id,status").eq("user_id", userId),
    ]);

    const d = deals.data ?? [];
    const bm = brandMatches.data ?? [];
    const ap = approvals.data ?? [];

    const activeDeals = d.filter(
      (x) => x.status !== "completed" && x.status !== "cancelled" && x.invoice_status !== "paid",
    ).length;

    const newMatches = bm.filter((x) => x.status === "new").length;

    const pendingApprovals = ap.filter((x) => x.status === "pending").length;

    const pipelineValue = bm
      .filter((x) => x.status !== "rejected" && x.status !== "paid")
      .reduce((sum, x) => sum + Number(x.estimated_deal_max ?? 0), 0);

    const escrow = d
      .filter((x) => x.escrow_status === "funded")
      .reduce((sum, x) => sum + Number(x.deal_value ?? 0), 0);

    const earned = d
      .filter((x) => x.invoice_status === "paid")
      .reduce((sum, x) => sum + Number(x.deal_value ?? 0), 0);

    return {
      activeDeals,
      newMatches,
      pendingApprovals,
      pipelineValue,
      escrow,
      earned,
    };
  });

/**
 * The most recent pending approvals (max 4) and the top 3 new brand matches by fit_score.
 * Powers the side-by-side panels on /dashboard Home.
 */
export const getHomePanels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [approvals, matches] = await Promise.all([
      supabase
        .from("approvals")
        .select("id,approval_type,brand_name,amount,created_at")
        .eq("user_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(4),
      supabase
        .from("brand_matches")
        .select("id,brand_name,fit_score,suggested_package,estimated_deal_min,estimated_deal_max")
        .eq("user_id", userId)
        .eq("status", "new")
        .order("fit_score", { ascending: false })
        .limit(3),
    ]);

    return {
      approvals: approvals.data ?? [],
      matches: matches.data ?? [],
    };
  });

/**
 * Agent home feed: greeting name, "needs your attention" decision cards,
 * and recent "what I handled" agent activity. Pure read; no schema changes.
 */
export const getAgentHome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [
      { data: profile },
      { data: pendingApprovals },
      { data: unrepliedReplies },
      { data: pricingRules },
      { data: activity },
    ] = await Promise.all([
      supabase.from("profiles").select("display_name,full_name").eq("user_id", userId).maybeSingle(),
      supabase
        .from("approvals")
        .select("id,brand_name,approval_type")
        .eq("user_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("outreach_emails")
        .select("id,subject,brand_match_id")
        .eq("user_id", userId)
        .eq("replied", true)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("pricing_rules")
        .select("id,rate_floor,configured")
        .eq("user_id", userId)
        .limit(1),
      supabase
        .from("agent_activity")
        .select("id,activity_type,title,description,action_label,action_route,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    // Resolve brand names for replies via brand_matches.
    const matchIds = (unrepliedReplies ?? [])
      .map((r) => r.brand_match_id)
      .filter((x): x is string => !!x);
    let brandById = new Map<string, string>();
    if (matchIds.length) {
      const { data: bm } = await supabase
        .from("brand_matches")
        .select("id,brand_name")
        .in("id", matchIds);
      brandById = new Map((bm ?? []).map((b) => [b.id, b.brand_name]));
    }

    const rule = pricingRules?.[0];
    const needsMinRate = !rule || rule.rate_floor == null || Number(rule.rate_floor) <= 0;

    const displayName =
      profile?.display_name?.trim() ||
      profile?.full_name?.split(" ")[0]?.trim() ||
      "there";

    type AttentionItem = {
      id: string;
      kind: "approvals" | "reply" | "min_rate";
      title: string;
      body: string;
      primary: { label: string; to: string };
      secondary?: { label: string; to: string };
    };

    const attention: AttentionItem[] = [];

    if ((pendingApprovals?.length ?? 0) > 0) {
      const n = pendingApprovals!.length;
      attention.push({
        id: "approvals",
        kind: "approvals",
        title: `Approve ${n} outreach draft${n === 1 ? "" : "s"}`,
        body: `I drafted short personalized message${n === 1 ? "" : "s"} for ${n === 1 ? "a brand" : `${n} brands`} that fit your content.`,
        primary: { label: "Review first", to: "/dashboard/approvals" },
        secondary: { label: "Approve all", to: "/dashboard/approvals" },
      });
    }

    for (const r of unrepliedReplies ?? []) {
      const brand = (r.brand_match_id && brandById.get(r.brand_match_id)) || "A brand";
      attention.push({
        id: `reply-${r.id}`,
        kind: "reply",
        title: `${brand} replied — review needed`,
        body: `They responded to "${r.subject ?? "your pitch"}". I'll suggest a reply.`,
        primary: { label: "Review reply", to: "/dashboard/approvals" },
      });
    }

    if (needsMinRate) {
      attention.push({
        id: "min-rate",
        kind: "min_rate",
        title: "Confirm your minimum rate",
        body: "I need to know your walk-away price so I never quote below it.",
        primary: { label: "Set minimum", to: "/dashboard/settings" },
      });
    }

    return {
      displayName,
      attention: attention.slice(0, 6),
      activity: activity ?? [],
    };
  });

/**
 * Last 10 notifications for the current user (top-bar bell dropdown).
 */
export const listNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);
    return { notifications: data ?? [] };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);
    return { ok: true };
  });

const MarkOne = z.object({ id: z.string().uuid() });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => MarkOne.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("id", data.id);
    return { ok: true };
  });

const SearchSchema = z.object({ q: z.string().min(1).max(120) });

/**
 * Top-bar search across brand_matches, deals, outreach_emails.
 * Returns up to 3 results per section.
 */
export const searchAll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SearchSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const like = `%${data.q.replace(/[%_]/g, "")}%`;

    const [brands, deals, outreach] = await Promise.all([
      supabase
        .from("brand_matches")
        .select("id,brand_name,status")
        .eq("user_id", userId)
        .ilike("brand_name", like)
        .limit(3),
      supabase
        .from("deals")
        .select("id,brand_name,status")
        .eq("user_id", userId)
        .ilike("brand_name", like)
        .limit(3),
      supabase
        .from("outreach_emails")
        .select("id,subject,sent,replied")
        .eq("user_id", userId)
        .ilike("subject", like)
        .limit(3),
    ]);

    return {
      brands: brands.data ?? [],
      deals: deals.data ?? [],
      outreach: outreach.data ?? [],
    };
  });

/**
 * Lightweight user info for the sidebar bottom card.
 */
export const getCurrentUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: stats }, { data: creator }] = await Promise.all([
      supabase.from("profiles").select("full_name,display_name,avatar_url,email,plan").eq("user_id", userId).maybeSingle(),
      supabase.from("platform_stats").select("follower_count").eq("user_id", userId),
      supabase
        .from("creator_profiles")
        .select("verified,verification_status,verified_platform,verified_handle,verification_skipped")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const totalFollowers = (stats ?? []).reduce(
      (sum, s) => sum + Number(s.follower_count ?? 0),
      0,
    );

    let tier = "Under 100K creator";
    if (totalFollowers >= 1_000_000) tier = "1M+ creator";
    else if (totalFollowers >= 500_000) tier = "500K+ creator";
    else if (totalFollowers >= 100_000) tier = "100K+ creator";

    return {
      profile: profile ?? null,
      tier,
      totalFollowers,
      verification: creator ?? null,
    };
  });


/**
 * Settings page — profile + notification prefs + platform stats summary.
 */
export const getSettingsData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: platforms }, { data: verifications }] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name,display_name,avatar_url,email,bio,plan,notification_prefs,connected_platforms,sender_email")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("platform_stats")
        .select("platform,handle,follower_count")
        .eq("user_id", userId),
      supabase
        .from("platform_verifications")
        .select("platform,handle,status,verified_at,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ]);
    return {
      profile: profile ?? null,
      platforms: platforms ?? [],
      verifications: verifications ?? [],
    };
  });


const ProfileUpdateSchema = z.object({
  full_name: z.string().trim().max(120).optional(),
  display_name: z.string().trim().max(60).optional(),
  bio: z.string().trim().max(500).optional(),
  sender_email: z.string().trim().email().max(255).or(z.literal("")).optional(),
});

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProfileUpdateSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("profiles").update(data).eq("user_id", userId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

const NotifPrefsSchema = z.object({
  email_brand_match: z.boolean().optional(),
  email_brand_reply: z.boolean().optional(),
  email_payment: z.boolean().optional(),
  email_weekly_digest: z.boolean().optional(),
  inapp_approvals: z.boolean().optional(),
  inapp_activity: z.boolean().optional(),
});

export const updateNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => NotifPrefsSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("profiles")
      .select("notification_prefs")
      .eq("user_id", userId)
      .maybeSingle();
    const merged = { ...((existing?.notification_prefs as object) ?? {}), ...data };
    const { error } = await supabase
      .from("profiles")
      .update({ notification_prefs: merged })
      .eq("user_id", userId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, prefs: merged };
  });

/**
 * Re-scrape the user's primary social profile and refresh avatar_url.
 */
export const refreshAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const token = process.env.APIFY_TOKEN;
    if (!token) return { ok: false, error: "Scraper unavailable" as const };

    const { data: stats } = await supabase
      .from("platform_stats")
      .select("platform,handle,follower_count")
      .eq("user_id", userId)
      .order("follower_count", { ascending: false, nullsFirst: false });

    const primary = (stats ?? []).find((s) => s.handle && s.platform);
    if (!primary?.handle || !primary?.platform) {
      return { ok: false, error: "No connected handle yet — finish onboarding first." as const };
    }

    const run = await startActorRun(primary.platform, primary.handle, token);
    if (!run) return { ok: false, error: "Could not start scraper" as const };

    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const st = await getRunStatus(run.runId, token);
      if (st.status === "complete" && st.datasetId) {
        const items = await fetchDatasetItems(st.datasetId, token);
        const first = (items?.[0] ?? {}) as Record<string, any>;
        const avatarUrl: string | null =
          first.profilePicUrlHD ??
          first.profilePicUrl ??
          first.authorMeta?.avatar ??
          first.avatar ??
          first.channelLogoUrl ??
          first.thumbnail ??
          null;
        if (!avatarUrl) return { ok: false, error: "Profile image not found in scrape" as const };
        await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("user_id", userId);
        return { ok: true as const, avatarUrl };
      }
      if (st.status === "failed") return { ok: false, error: "Scraper failed" as const };
    }
    return { ok: false, error: "Scraper timeout — try again in a moment" as const };
  });

/**
 * Agent permission mode — derived from agent_rules booleans.
 * draft_only: never sends, always drafts.
 * approval:   drafts; sends after approval (default).
 * autopilot:  sends approved brand types, follows up, only asks on replies/pricing.
 */
export const getAgentMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("agent_rules")
      .select("approval_before_send,auto_outreach,auto_follow_up")
      .eq("user_id", userId)
      .maybeSingle();
    const r = data ?? { approval_before_send: true, auto_outreach: false, auto_follow_up: false };
    const mode: "draft_only" | "approval" | "autopilot" =
      r.auto_outreach
        ? "autopilot"
        : r.approval_before_send === false
          ? "draft_only"
          : "approval";
    return { mode };
  });

const ModeSchema = z.object({
  mode: z.enum(["draft_only", "approval", "autopilot"]),
});

export const setAgentMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ModeSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch =
      data.mode === "autopilot"
        ? { approval_before_send: true, auto_outreach: true, auto_follow_up: true, rules_configured: true }
        : data.mode === "draft_only"
          ? { approval_before_send: false, auto_outreach: false, auto_follow_up: false, rules_configured: true }
          : { approval_before_send: true, auto_outreach: false, auto_follow_up: false, rules_configured: true };

    const { data: existing } = await supabase
      .from("agent_rules")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    const { error } = existing
      ? await supabase.from("agent_rules").update(patch).eq("user_id", userId)
      : await supabase.from("agent_rules").insert({ user_id: userId, ...patch });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, mode: data.mode };
  });

/* ============================================================
 * Hyper-personalization: voice, autonomy, growth stage, pricing
 * posture, plus an editable Agent Memory list.
 * ============================================================ */

const PersonalizationSchema = z.object({
  voice_formality: z.enum(["casual", "balanced", "professional"]).optional(),
  voice_length: z.enum(["short", "medium", "detailed"]).optional(),
  voice_warmth: z.enum(["warm", "neutral", "direct"]).optional(),
  explanation_level: z.enum(["handle_it", "balanced", "teach_me"]).optional(),
  autonomy_level: z.enum(["low", "medium", "high"]).optional(),
  pricing_aggressiveness: z.enum(["conservative", "balanced", "aggressive"]).optional(),
  growth_stage: z.enum(["beginner", "growing", "established"]).optional(),
  confidence_level: z.enum(["nervous", "balanced", "confident"]).optional(),
  cta_style: z.enum(["soft", "balanced", "direct"]).optional(),
});

export const getPersonalization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("creator_profiles")
      .select(
        "voice_formality, voice_length, voice_warmth, explanation_level, autonomy_level, pricing_aggressiveness, growth_stage, confidence_level, cta_style, agent_memory",
      )
      .eq("user_id", userId)
      .maybeSingle();
    return {
      personalization: {
        voice_formality: data?.voice_formality ?? "balanced",
        voice_length: data?.voice_length ?? "short",
        voice_warmth: data?.voice_warmth ?? "warm",
        explanation_level: data?.explanation_level ?? "balanced",
        autonomy_level: data?.autonomy_level ?? "medium",
        pricing_aggressiveness: data?.pricing_aggressiveness ?? "balanced",
        growth_stage: data?.growth_stage ?? "growing",
        confidence_level: data?.confidence_level ?? "balanced",
        cta_style: data?.cta_style ?? "soft",
      },
      memory: Array.isArray(data?.agent_memory) ? (data.agent_memory as Array<{ id: string; text: string; source?: string; created_at?: string }>) : [],
    };
  });

export const updatePersonalization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => PersonalizationSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // ensure a row exists
    const { data: existing } = await supabase
      .from("creator_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    const { error } = existing
      ? await supabase.from("creator_profiles").update(data).eq("user_id", userId)
      : await supabase.from("creator_profiles").insert({ user_id: userId, ...data });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

const AddMemorySchema = z.object({
  text: z.string().trim().min(4).max(240),
  source: z.string().max(40).optional(),
});

export const addAgentMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => AddMemorySchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("creator_profiles")
      .select("agent_memory")
      .eq("user_id", userId)
      .maybeSingle();
    const list = Array.isArray(row?.agent_memory) ? (row.agent_memory as Array<{ id: string; text: string; source?: string; created_at?: string }>) : [];
    // de-dupe by text
    if (list.some((m) => m.text.toLowerCase().trim() === data.text.toLowerCase().trim())) {
      return { ok: true as const, dedup: true as const };
    }
    const entry = {
      id: crypto.randomUUID(),
      text: data.text,
      source: data.source ?? "manual",
      created_at: new Date().toISOString(),
    };
    const next = [entry, ...list].slice(0, 80);
    const { error } = await supabase
      .from("creator_profiles")
      .update({ agent_memory: next })
      .eq("user_id", userId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, entry };
  });

const RemoveMemorySchema = z.object({ id: z.string().min(1) });

export const removeAgentMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => RemoveMemorySchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("creator_profiles")
      .select("agent_memory")
      .eq("user_id", userId)
      .maybeSingle();
    const list = Array.isArray(row?.agent_memory) ? (row.agent_memory as Array<{ id: string; text: string }>) : [];
    const next = list.filter((m) => m.id !== data.id);
    const { error } = await supabase
      .from("creator_profiles")
      .update({ agent_memory: next })
      .eq("user_id", userId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

const EditMemorySchema = z.object({
  id: z.string().min(1),
  text: z.string().trim().min(4).max(240),
});

export const editAgentMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => EditMemorySchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("creator_profiles")
      .select("agent_memory")
      .eq("user_id", userId)
      .maybeSingle();
    const list = Array.isArray(row?.agent_memory) ? (row.agent_memory as Array<{ id: string; text: string; source?: string; created_at?: string }>) : [];
    const next = list.map((m) => (m.id === data.id ? { ...m, text: data.text } : m));
    const { error } = await supabase
      .from("creator_profiles")
      .update({ agent_memory: next })
      .eq("user_id", userId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });
