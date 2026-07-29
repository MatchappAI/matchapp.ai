import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  fetchDatasetItems,
  getRunStatus,
  normalizeApifyResult,
  normalizeHandle,
  pickActor,
  startActorRun,
} from "./apify.server";

const StartSchema = z.object({
  handle: z.string().min(1).max(120),
  platform: z.string().min(1).max(40),
});

/**
 * Start an async Apify run for {handle, platform}. Persists a row in apify_runs
 * so step 3 can poll. Returns {runId} or {runId: null} for platforms without an
 * actor mapped (LinkedIn / Twitch / Podcast) — caller should treat null as "no
 * scrape, proceed with whatever data we already have".
 */
export const startApifyScrape = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => StartSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const token = process.env.APIFY_TOKEN;
    if (!token) {
      console.error("[apify] APIFY_TOKEN missing");
      return { runId: null as string | null };
    }
    const platform = data.platform.toLowerCase();
    const handle = normalizeHandle(data.handle);

    if (!pickActor(platform)) {
      return { runId: null };
    }

    const started = await startActorRun(platform, handle, token);
    if (!started) return { runId: null };

    await supabaseAdmin.from("apify_runs").insert({
      user_id: userId,
      platform,
      handle,
      run_id: started.runId,
      status: "pending",
    });

    return { runId: started.runId };
  });

const StatusSchema = z.object({ runId: z.string().min(1).max(200) });

/**
 * Poll a previously-started Apify run. When it succeeds, fetch the dataset,
 * normalize, write into platform_stats, and mark the apify_runs row complete.
 */
export const apifyStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => StatusSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const token = process.env.APIFY_TOKEN;
    if (!token) return { status: "failed" as const };

    const { data: run } = await supabaseAdmin
      .from("apify_runs")
      .select("*")
      .eq("run_id", data.runId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!run) return { status: "failed" as const };

    if (run.status === "complete") return { status: "complete" as const };
    if (run.status === "failed") return { status: "failed" as const };

    const res = await getRunStatus(data.runId, token);
    if (res.status === "pending") return { status: "pending" as const };
    if (res.status === "failed") {
      await supabaseAdmin
        .from("apify_runs")
        .update({ status: "failed" })
        .eq("id", run.id);
      return { status: "failed" as const };
    }

    // Complete — pull dataset, normalize, persist.
    const items = res.datasetId ? await fetchDatasetItems(res.datasetId, token) : [];
    const stats = normalizeApifyResult(run.platform, items);
    const firstItem = (items?.[0] ?? {}) as Record<string, any>;
    const avatarUrl: string | null =
      firstItem.profilePicUrlHD ??
      firstItem.profilePicUrl ??
      firstItem.authorMeta?.avatar ??
      firstItem.avatar ??
      firstItem.channelLogoUrl ??
      firstItem.thumbnail ??
      null;

    // platform_stats has no unique constraint; delete-then-insert per (user, platform).
    await supabaseAdmin
      .from("platform_stats")
      .delete()
      .eq("user_id", userId)
      .eq("platform", run.platform);

    await supabaseAdmin.from("platform_stats").insert({
      user_id: userId,
      platform: run.platform,
      handle: run.handle,
      follower_count: stats.follower_count,
      avg_views: stats.avg_views,
      avg_likes: stats.avg_likes,
      engagement_rate: stats.engagement_rate,
      top_content_categories: stats.top_content_categories,
      posting_cadence: stats.posting_cadence,
      recent_post_snapshot: stats.recent_post_snapshot,
      fetched_at: new Date().toISOString(),
    });

    if (avatarUrl) {
      await supabaseAdmin
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("user_id", userId);
    }

    await supabaseAdmin
      .from("apify_runs")
      .update({ status: "complete" })
      .eq("id", run.id);

    return { status: "complete" as const };
  });
