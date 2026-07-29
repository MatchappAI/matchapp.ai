import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PlatformEnum = z.enum(["tiktok", "instagram", "youtube", "linkedin", "twitch", "podcast"]);

const Step1Schema = z.object({
  full_name: z.string().min(1).max(120),
  niche: z.string().min(1).max(120),
  handles: z
    .array(
      z.object({
        platform: PlatformEnum,
        handle: z.string().min(1).max(120),
      }),
    )
    .min(1)
    .max(6),
});

export const saveStep1 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Step1Schema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Normalize handles (strip leading @) and pick a primary = first in the user's list.
    const normalized = data.handles.map((h) => ({
      platform: h.platform,
      handle: h.handle.trim().replace(/^@+/, ""),
    }));
    const primary = normalized[0];

    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        creator_handle: primary.handle,
        connected_platforms: normalized.map((h) => h.platform),
        onboarding_step: 2,
      })
      .eq("user_id", userId);

    await supabaseAdmin.from("creator_profiles").upsert(
      {
        user_id: userId,
        full_name: data.full_name,
        primary_platform: primary.platform,
        handle: primary.handle,
        niche: data.niche,
        platforms: normalized.map((h) => h.platform),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    return { ok: true, handles: normalized };
  });

// Reduced to 3 questions per restructure brief: min deal value, blocked categories, market scope.
// Location is asked only when market_scope needs it (local / both).
const Step2Schema = z.object({
  min_deal_value: z.number().int().min(0).max(10_000_000),
  blocked_categories: z.string().max(500).optional().nullable(),
  market_scope: z.enum(["local", "international", "both"]),
  location: z.string().max(120).optional().nullable(),
});

export const saveStep2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Step2Schema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    await supabaseAdmin
      .from("creator_profiles")
      .update({
        min_deal_value: data.min_deal_value,
        market_scope: data.market_scope,
        location: data.location?.trim() || null,
      })
      .eq("user_id", userId);

    if (data.blocked_categories) {
      await supabaseAdmin.from("brand_preferences").upsert(
        {
          user_id: userId,
          blocked_categories: data.blocked_categories,
          configured: true,
        },
        { onConflict: "user_id" },
      );
    }

    await supabaseAdmin.from("profiles").update({ onboarding_step: 3 }).eq("user_id", userId);
    return { ok: true };
  });

/**
 * Finalizes the single-screen onboarding: marks the profile complete and
 * bumps the step so the dashboard loader stops redirecting back to /onboarding.
 * Scrape + AI analysis run in the background and populate the dashboard as
 * they finish; the user does not wait on them.
 */
export const completeQuickOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await supabaseAdmin
      .from("profiles")
      .update({ onboarding_complete: true, onboarding_step: 3 })
      .eq("user_id", context.userId);
    return { ok: true };
  });

/**
 * Per-platform follower fallback: when an Apify run fails (or a platform has no actor),
 * the client asks the user for a follower count and writes it into platform_stats.
 */
const ManualStatsSchema = z.object({
  platform: PlatformEnum,
  handle: z.string().min(1).max(120),
  follower_count: z.number().int().min(0).max(1_000_000_000),
});

export const saveManualPlatformStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ManualStatsSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await supabaseAdmin
      .from("platform_stats")
      .delete()
      .eq("user_id", userId)
      .eq("platform", data.platform);
    await supabaseAdmin.from("platform_stats").insert({
      user_id: userId,
      platform: data.platform,
      handle: data.handle.replace(/^@+/, ""),
      follower_count: data.follower_count,
      fetched_at: new Date().toISOString(),
    });
    return { ok: true };
  });

/**
 * Post-onboarding: user adds an additional social handle from Settings.
 * Inserts a stub platform_stats row (so it renders immediately) and appends
 * to profiles.connected_platforms. The client should then fire startScrapeAll
 * for this handle to fill in real follower/engagement data.
 */
const AddHandleSchema = z.object({
  platform: PlatformEnum,
  handle: z.string().min(1).max(120),
});

export const addSocialHandle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => AddHandleSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const handle = data.handle.trim().replace(/^@+/, "");

    // Upsert stub so Settings shows it immediately; scrape will overwrite follower_count.
    await supabaseAdmin
      .from("platform_stats")
      .delete()
      .eq("user_id", userId)
      .eq("platform", data.platform);
    await supabaseAdmin.from("platform_stats").insert({
      user_id: userId,
      platform: data.platform,
      handle,
      follower_count: 0,
      fetched_at: new Date().toISOString(),
    });

    // Append to profiles.connected_platforms (dedupe).
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("connected_platforms")
      .eq("user_id", userId)
      .maybeSingle();
    const current = (prof?.connected_platforms as string[] | null) ?? [];
    const next = Array.from(new Set([...current, data.platform]));
    await supabaseAdmin
      .from("profiles")
      .update({ connected_platforms: next })
      .eq("user_id", userId);

    return { ok: true, platform: data.platform, handle };
  });

/**
 * Read/update the answers users gave during onboarding, from the Settings page.
 * Covers step 1 (name + niche) and step 2 (min deal value, blocked categories,
 * market scope, location).
 */
export const getOnboardingAnswers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const [{ data: cp }, { data: prefs }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("creator_profiles")
        .select("full_name,niche,min_deal_value,market_scope,location")
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("brand_preferences")
        .select("blocked_categories")
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    return {
      full_name: cp?.full_name ?? profile?.full_name ?? "",
      niche: cp?.niche ?? "",
      min_deal_value: cp?.min_deal_value ?? 0,
      market_scope: (cp?.market_scope ?? "both") as "local" | "international" | "both",
      location: cp?.location ?? "",
      blocked_categories: prefs?.blocked_categories ?? "",
    };
  });

const UpdateAnswersSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  niche: z.string().trim().min(1).max(120),
  min_deal_value: z.number().int().min(0).max(10_000_000),
  market_scope: z.enum(["local", "international", "both"]),
  location: z.string().trim().max(120).optional().nullable(),
  blocked_categories: z.string().trim().max(500).optional().nullable(),
});

export const updateOnboardingAnswers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UpdateAnswersSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.full_name })
      .eq("user_id", userId);

    await supabaseAdmin
      .from("creator_profiles")
      .update({
        full_name: data.full_name,
        niche: data.niche,
        min_deal_value: data.min_deal_value,
        market_scope: data.market_scope,
        location: data.location?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    await supabaseAdmin.from("brand_preferences").upsert(
      {
        user_id: userId,
        blocked_categories: data.blocked_categories?.trim() || null,
        configured: true,
      },
      { onConflict: "user_id" },
    );

    return { ok: true as const };
  });
