/**
 * Server-only helpers for platform verification.
 * - Generates 6-char short codes (MATCH-XXXX).
 * - Synchronously scrapes the bio for a {platform, handle} via Apify with a
 *   20s hard timeout, and returns the bio text + apify run id (when present).
 */

const APIFY_BASE = "https://api.apify.com/v2";

const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L

export function generateCode(): string {
  // Worker-safe randomness
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < 4; i++) out += CHARSET[bytes[i] % CHARSET.length];
  return `MATCH-${out}`;
}

/** Returns minutes-remaining as a positive integer (>=0). */
export function minutesRemaining(expiresAt: string): number {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 60000));
}

type ScrapeResult =
  | { ok: true; bio: string; apifyRunId: string | null }
  | { ok: false; reason: "private_or_empty" | "scrape_timeout" | "unsupported" | "no_token" | "scrape_failed" };

const ACTORS: Record<string, string> = {
  tiktok: "clockworks~tiktok-profile-scraper",
  instagram: "apify~instagram-profile-scraper",
  youtube: "streamers~youtube-scraper",
  twitter: "apidojo~tweet-scraper",
  linkedin: "curious_coder~linkedin-profile-scraper",
};

function normalizeHandle(h: string): string {
  return h.trim().replace(/^@+/, "");
}

function actorInput(platform: string, handle: string): Record<string, unknown> {
  const h = normalizeHandle(handle);
  switch (platform) {
    case "tiktok":
      return { profiles: [h], resultsPerPage: 3, shouldDownloadVideos: false };
    case "instagram":
      return { usernames: [h], resultsLimit: 1 };
    case "youtube":
      return { startUrls: [{ url: `https://www.youtube.com/@${h}` }], maxResults: 1 };
    case "twitter":
      return { startUrls: [`https://twitter.com/${h}`], maxItems: 1 };
    case "linkedin":
      return {
        urls: [h.startsWith("http") ? h : `https://www.linkedin.com/in/${h}/`],
      };
    default:
      return { handle: h };
  }
}

function extractBio(platform: string, items: unknown[]): string {
  if (!items.length) return "";
  const first = items[0] as Record<string, any>;
  switch (platform) {
    case "tiktok":
      return String(first?.authorMeta?.signature ?? first?.signature ?? "");
    case "instagram":
      return String(first?.biography ?? "");
    case "youtube":
      return String(first?.description ?? first?.channelDescription ?? "");
    case "twitter":
      return String(first?.user?.description ?? first?.author?.description ?? first?.description ?? "");
    case "linkedin":
      return String(first?.summary ?? first?.about ?? first?.headline ?? "");
    default:
      return "";
  }
}

function extractContactEmail(items: unknown[], bio: string): string | null {
  const first = (items[0] ?? {}) as Record<string, any>;
  const direct =
    first?.public_email ||
    first?.business_email ||
    first?.businessEmail ||
    first?.contactEmail ||
    first?.authorMeta?.email ||
    null;
  if (typeof direct === "string" && /@/.test(direct)) return direct.trim().toLowerCase();
  const m = bio.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  return m ? m[0].toLowerCase() : null;
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!user || !domain) return email;
  const head = user.slice(0, Math.min(2, user.length));
  const tail = user.length > 3 ? user.slice(-1) : "";
  return `${head}${"•".repeat(Math.max(1, user.length - head.length - tail.length))}${tail}@${domain}`;
}

export function generateNumericCode(len = 6): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += String(bytes[i] % 10);
  return out;
}

export async function hashCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(`matchai:v1:${code}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Scrape and return the profile's public contact email, if any. */
export async function scrapeContactEmail(
  platform: string,
  handle: string,
): Promise<
  | { ok: true; email: string; apifyRunId: string | null }
  | { ok: false; reason: "no_email" | "private_or_empty" | "scrape_timeout" | "unsupported" | "no_token" | "scrape_failed" }
> {
  const token = process.env.APIFY_TOKEN;
  if (!token) return { ok: false, reason: "no_token" };
  const actor = ACTORS[platform];
  if (!actor) return { ok: false, reason: "unsupported" };

  const url = `${APIFY_BASE}/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=18&memory=512`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  let runId: string | null = null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(actorInput(platform, handle)),
      signal: controller.signal,
    });
    runId = res.headers.get("X-Apify-Run-Id") || res.headers.get("x-apify-run-id");
    if (!res.ok) return { ok: false, reason: "scrape_failed" };
    const items = (await res.json()) as unknown[];
    const bio = extractBio(platform, items).trim();
    const email = extractContactEmail(items, bio);
    if (!email) return { ok: false, reason: bio ? "no_email" : "private_or_empty" };
    return { ok: true, email, apifyRunId: runId };
  } catch (e) {
    if ((e as Error).name === "AbortError") return { ok: false, reason: "scrape_timeout" };
    return { ok: false, reason: "scrape_failed" };
  } finally {
    clearTimeout(timer);
  }
}

export async function sendVerificationEmail(
  to: string,
  code: string,
  platform: string,
): Promise<{ ok: boolean; error?: string }> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return { ok: false, error: "Email sending not configured." };
  const from = `MatchAI Verify <verify@notify.www.matchapp.ai>`;
  const subject = `Your MatchAI verification code: ${code}`;
  const html = `<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;color:#0b0b0f;padding:24px;">
    <div style="max-width:480px;margin:0 auto;">
      <h2 style="margin:0 0 12px 0;">Verify your ${platform} account</h2>
      <p style="color:#444;margin:0 0 20px 0;line-height:1.5;">Enter this code in MatchAI to confirm you own the account that lists <b>${to}</b> as its public contact email.</p>
      <div style="font-family:ui-monospace,SFMono-Regular,monospace;font-size:32px;letter-spacing:.35em;font-weight:800;background:#f3f0ff;color:#1a1147;padding:16px 20px;border-radius:12px;text-align:center;">${code}</div>
      <p style="color:#888;font-size:12px;margin-top:20px;">This code expires in 10 minutes. If you didn't request it, ignore this email.</p>
    </div></body></html>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({ from, to: [to], subject, html, text: `Your MatchAI verification code: ${code} (expires in 10 minutes).` }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[verify-email] resend failed", res.status, text);
    return { ok: false, error: `Send failed (${res.status}).` };
  }
  return { ok: true };
}

/**
 * Synchronously runs an Apify actor and returns its dataset items.
 * Uses the run-sync-get-dataset-items endpoint with a hard 20s client-side timeout.
 */
export async function scrapeBio(
  platform: string,
  handle: string,
): Promise<ScrapeResult> {
  const token = process.env.APIFY_TOKEN;
  if (!token) return { ok: false, reason: "no_token" };
  const actor = ACTORS[platform];
  if (!actor) return { ok: false, reason: "unsupported" };

  const url = `${APIFY_BASE}/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=18&memory=512`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);

  let runId: string | null = null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(actorInput(platform, handle)),
      signal: controller.signal,
    });
    runId = res.headers.get("X-Apify-Run-Id") || res.headers.get("x-apify-run-id");
    if (!res.ok) {
      console.error("[verify-scrape] non-ok", res.status, await res.text().catch(() => ""));
      return { ok: false, reason: "scrape_failed" };
    }
    const items = (await res.json()) as unknown[];
    const bio = extractBio(platform, items).trim();
    if (!bio) return { ok: false, reason: "private_or_empty" };
    return { ok: true, bio, apifyRunId: runId };
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      return { ok: false, reason: "scrape_timeout" };
    }
    console.error("[verify-scrape] error", e);
    return { ok: false, reason: "scrape_failed" };
  } finally {
    clearTimeout(timer);
  }
}

export function isPodcastLike(platform: string): boolean {
  const p = platform.toLowerCase();
  return p === "podcast" || p === "rss";
}
