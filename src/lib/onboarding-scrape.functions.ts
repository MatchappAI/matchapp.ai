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

/**
 * Onboarding scrape orchestration:
 *  - startScrapeAll(handles[])    → fires Apify per platform in parallel and writes apify_runs rows
 *  - scrapeStatusAll()            → polls every in-flight run for the user, persists platform_stats
 *                                   for completed ones, returns a status snapshot per platform
 *  - aggregateCreatorProfile()    → rolls platform_stats up into creator_profiles
 *                                   (follower_count = sum, bio = first non-empty, etc.)
 *
 * Polling lives on the client; serverFn can't push SSE.
 */

const HANDLES = z
  .array(z.object({ platform: z.string().min(1).max(40), handle: z.string().min(1).max(120) }))
  .min(1)
  .max(8);

export const startScrapeAll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ handles: HANDLES }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const token = process.env.APIFY_TOKEN;
    if (!token) {
      console.error("[scrape] APIFY_TOKEN missing");
      return { started: [] as { platform: string; runId: string | null }[] };
    }

    // Clear any prior in-flight runs for these platforms so polling sees only the new batch.
    const platforms = data.handles.map((h) => h.platform.toLowerCase());
    await supabaseAdmin
      .from("apify_runs")
      .delete()
      .eq("user_id", userId)
      .in("platform", platforms);

    const tasks = data.handles.map(async ({ platform, handle }) => {
      const p = platform.toLowerCase();
      const h = normalizeHandle(handle);
      if (!pickActor(p)) {
        // Platforms without an actor (linkedin/twitch/podcast): no scrape, treat as manual.
        await supabaseAdmin.from("apify_runs").insert({
          user_id: userId,
          platform: p,
          handle: h,
          run_id: `manual:${p}:${h}`,
          status: "failed", // marks "needs manual follower entry"
        });
        return { platform: p, runId: null as string | null };
      }
      const started = await startActorRun(p, h, token).catch(() => null);
      if (!started) {
        await supabaseAdmin.from("apify_runs").insert({
          user_id: userId,
          platform: p,
          handle: h,
          run_id: `failed:${p}:${h}`,
          status: "failed",
        });
        return { platform: p, runId: null };
      }
      await supabaseAdmin.from("apify_runs").insert({
        user_id: userId,
        platform: p,
        handle: h,
        run_id: started.runId,
        status: "pending",
      });
      return { platform: p, runId: started.runId };
    });

    const started = await Promise.all(tasks);
    return { started };
  });

export type PlatformScrapeStatus = {
  platform: string;
  handle: string;
  status: "pending" | "complete" | "failed";
};

/**
 * Poll every pending run for this user. For each completed run, fetch the dataset,
 * normalize, and write platform_stats. Idempotent — already-complete runs are skipped.
 */
export const scrapeStatusAll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const token = process.env.APIFY_TOKEN;

    const { data: runs } = await supabaseAdmin
      .from("apify_runs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    const seen = new Set<string>();
    const out: PlatformScrapeStatus[] = [];

    for (const run of runs ?? []) {
      if (seen.has(run.platform)) continue; // dedupe — only latest per platform
      seen.add(run.platform);

      if (run.status === "complete" || run.status === "failed") {
        out.push({ platform: run.platform, handle: run.handle, status: run.status });
        continue;
      }
      if (!token) {
        out.push({ platform: run.platform, handle: run.handle, status: "pending" });
        continue;
      }

      const res = await getRunStatus(run.run_id, token).catch(() => ({ status: "failed" as const }));
      if (res.status === "pending") {
        out.push({ platform: run.platform, handle: run.handle, status: "pending" });
        continue;
      }
      if (res.status === "failed") {
        await supabaseAdmin.from("apify_runs").update({ status: "failed" }).eq("id", run.id);
        out.push({ platform: run.platform, handle: run.handle, status: "failed" });
        continue;
      }

      // Complete → fetch + normalize + persist
      const items = res.datasetId ? await fetchDatasetItems(res.datasetId, token) : [];
      const stats = normalizeApifyResult(run.platform, items);
      const firstItem = (items?.[0] ?? {}) as Record<string, unknown>;
      const avatarUrl =
        (firstItem.profilePicUrlHD as string | undefined) ??
        (firstItem.profilePicUrl as string | undefined) ??
        ((firstItem.authorMeta as { avatar?: string } | undefined)?.avatar) ??
        (firstItem.avatar as string | undefined) ??
        (firstItem.channelLogoUrl as string | undefined) ??
        (firstItem.thumbnail as string | undefined) ??
        null;

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

      // Persist bio onto creator_profiles if we found one and one isn't set yet.
      if (stats.bio) {
        await supabaseAdmin
          .from("creator_profiles")
          .update({ bio: stats.bio })
          .eq("user_id", userId)
          .is("bio", null);
      }

      if (avatarUrl) {
        await supabaseAdmin
          .from("profiles")
          .update({ avatar_url: avatarUrl })
          .eq("user_id", userId);
      }

      await supabaseAdmin.from("apify_runs").update({ status: "complete" }).eq("id", run.id);
      out.push({ platform: run.platform, handle: run.handle, status: "complete" });
    }

    return { runs: out };
  });

/**
 * Roll completed platform_stats up into creator_profiles.
 * follower_count = sum across platforms; primary_platform = the one with the most followers.
 */
export const aggregateCreatorProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: stats } = await supabaseAdmin
      .from("platform_stats")
      .select("platform, handle, follower_count, posting_cadence")
      .eq("user_id", userId);

    if (!stats || stats.length === 0) return { ok: false as const };

    const totalFollowers = stats.reduce((acc, s) => acc + (s.follower_count ?? 0), 0);
    const top = [...stats].sort((a, b) => (b.follower_count ?? 0) - (a.follower_count ?? 0))[0];
    const cadence = stats.find((s) => s.posting_cadence)?.posting_cadence ?? null;
    const platforms = stats.map((s) => s.platform);

    await supabaseAdmin
      .from("creator_profiles")
      .update({
        follower_count: totalFollowers > 0 ? totalFollowers : null,
        primary_platform: top?.platform ?? null,
        handle: top?.handle ?? null,
        platforms,
        posting_frequency: cadence,
      })
      .eq("user_id", userId);

    return { ok: true as const, totalFollowers, primary: top?.platform ?? null };
  });
