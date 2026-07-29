/**
 * Apify integration helpers (server-only).
 * Picks the right actor per platform, fires async runs, polls status,
 * and normalizes results into the platform_stats shape.
 */

const ACTORS: Record<string, string> = {
  tiktok: "clockworks~tiktok-profile-scraper",
  instagram: "apify~instagram-profile-scraper",
  youtube: "streamers~youtube-scraper",
};

const APIFY_BASE = "https://api.apify.com/v2";

export function pickActor(platform: string): string | null {
  return ACTORS[platform] ?? null;
}

export function normalizeHandle(handle: string): string {
  return handle.trim().replace(/^@+/, "");
}

function actorInput(platform: string, handle: string): Record<string, unknown> {
  const h = normalizeHandle(handle);
  switch (platform) {
    case "tiktok":
      return { profiles: [h], resultsPerPage: 10, shouldDownloadVideos: false };
    case "instagram":
      return { usernames: [h], resultsLimit: 10 };
    case "youtube":
      return { startUrls: [{ url: `https://www.youtube.com/@${h}` }], maxResults: 10 };
    default:
      return { handle: h };
  }
}

export async function startActorRun(
  platform: string,
  handle: string,
  token: string,
): Promise<{ runId: string } | null> {
  const actor = pickActor(platform);
  if (!actor) return null;
  const body = actorInput(platform, handle);
  const res = await fetch(`${APIFY_BASE}/acts/${actor}/runs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error("[apify] start run failed", res.status, await res.text().catch(() => ""));
    return null;
  }
  const j = (await res.json()) as { data?: { id?: string } };
  if (!j.data?.id) return null;
  return { runId: j.data.id };
}

export type ApifyRunStatus = "pending" | "complete" | "failed";

export async function getRunStatus(
  runId: string,
  token: string,
): Promise<{ status: ApifyRunStatus; datasetId?: string }> {
  const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { status: "failed" };
  const j = (await res.json()) as {
    data?: { status?: string; defaultDatasetId?: string };
  };
  const s = j.data?.status;
  if (s === "SUCCEEDED") {
    return { status: "complete", datasetId: j.data?.defaultDatasetId };
  }
  if (s === "FAILED" || s === "ABORTED" || s === "TIMED-OUT") {
    return { status: "failed" };
  }
  return { status: "pending" };
}

export async function fetchDatasetItems(datasetId: string, token: string): Promise<unknown[]> {
  const res = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?clean=true&limit=20`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return [];
  return (await res.json()) as unknown[];
}

export type NormalizedStats = {
  follower_count: number | null;
  avg_views: number | null;
  avg_likes: number | null;
  engagement_rate: number | null;
  top_content_categories: string[] | null;
  posting_cadence: string | null;
  bio: string | null;
  recent_post_snapshot: string | null;
};

export function normalizeApifyResult(
  platform: string,
  items: unknown[],
): NormalizedStats {
  const empty: NormalizedStats = {
    follower_count: null,
    avg_views: null,
    avg_likes: null,
    engagement_rate: null,
    top_content_categories: null,
    posting_cadence: null,
    bio: null,
    recent_post_snapshot: null,
  };
  if (!items.length) return empty;

  try {
    if (platform === "tiktok") {
      // clockworks/tiktok-profile-scraper returns video items with authorMeta + stats
      const first = items[0] as Record<string, any>;
      const author = first.authorMeta ?? {};
      const followers = author.fans ?? author.followers ?? null;
      const posts = items.slice(0, 10) as Record<string, any>[];
      const views = avg(posts.map((p) => num(p?.playCount)));
      const likes = avg(posts.map((p) => num(p?.diggCount)));
      const eng = followers && likes ? (likes / followers) * 100 : null;
      return {
        follower_count: int(followers),
        avg_views: int(views),
        avg_likes: int(likes),
        engagement_rate: eng != null ? Math.round(eng * 100) / 100 : null,
        top_content_categories: null,
        posting_cadence: null,
        bio: author.signature ?? null,
        recent_post_snapshot: posts
          .slice(0, 3)
          .map((p) => p?.text)
          .filter(Boolean)
          .join(" | ") || null,
      };
    }
    if (platform === "instagram") {
      const first = items[0] as Record<string, any>;
      const followers = first.followersCount ?? null;
      const posts = (first.latestPosts ?? []) as Record<string, any>[];
      const likes = avg(posts.map((p) => num(p?.likesCount)));
      const views = avg(posts.map((p) => num(p?.videoViewCount ?? p?.videoPlayCount)));
      const eng = followers && likes ? (likes / followers) * 100 : null;
      return {
        follower_count: int(followers),
        avg_views: int(views),
        avg_likes: int(likes),
        engagement_rate: eng != null ? Math.round(eng * 100) / 100 : null,
        top_content_categories: null,
        posting_cadence: null,
        bio: first.biography ?? null,
        recent_post_snapshot: posts
          .slice(0, 3)
          .map((p) => p?.caption)
          .filter(Boolean)
          .join(" | ") || null,
      };
    }
    if (platform === "youtube") {
      const first = items[0] as Record<string, any>;
      const followers = first.numberOfSubscribers ?? first.subscriberCount ?? null;
      const videos = (first.videos ?? items) as Record<string, any>[];
      const views = avg(videos.map((v) => num(v?.viewCount ?? v?.views)));
      const likes = avg(videos.map((v) => num(v?.likes)));
      const eng = followers && views ? (views / followers) * 100 : null;
      return {
        follower_count: int(followers),
        avg_views: int(views),
        avg_likes: int(likes),
        engagement_rate: eng != null ? Math.round(eng * 100) / 100 : null,
        top_content_categories: null,
        posting_cadence: null,
        bio: first.description ?? null,
        recent_post_snapshot: videos
          .slice(0, 3)
          .map((v) => v?.title)
          .filter(Boolean)
          .join(" | ") || null,
      };
    }
  } catch (e) {
    console.error("[apify] normalize failed", e);
  }
  return empty;
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}
function avg(arr: (number | null)[]): number | null {
  const xs = arr.filter((x): x is number => x != null);
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function int(v: unknown): number | null {
  const n = num(v);
  return n == null ? null : Math.round(n);
}
