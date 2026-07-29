import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";

const GMAIL_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
];

function baseUrl(): string {
  return (process.env.APP_BASE_URL ?? "https://showcase-smith-spot.lovable.app").trim();
}

function previewBaseUrl(): string {
  return (
    process.env.PREVIEW_APP_BASE_URL ??
    "https://id-preview--64dc7356-e06d-4118-bdce-c60f5c5454e9.lovable.app"
  ).trim();
}

function oauthBaseUrlFor(returnOrigin: string): string {
  try {
    const url = new URL(returnOrigin);
    if (url.hostname.endsWith(".lovableproject.com") || url.hostname.startsWith("id-preview--")) {
      return previewBaseUrl();
    }
    return url.origin;
  } catch {
    return baseUrl();
  }
}

function gmailRedirectUri(returnOrigin: string): string {
  return `${oauthBaseUrlFor(returnOrigin)}/oauth/gmail/return`.trim();
}

function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return atob(padded);
}

async function hmacSha256(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  let binary = "";
  for (const byte of new Uint8Array(sig)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signOAuthState(payload: { userId: string; returnOrigin: string }): Promise<string> {
  const { clientSecret } = requireClientCreds();
  const body = base64UrlEncode(
    JSON.stringify({ ...payload, nonce: crypto.randomUUID(), exp: Date.now() + 10 * 60 * 1000 }),
  );
  return `${body}.${await hmacSha256(body, clientSecret)}`;
}

async function verifyOAuthState(state: string): Promise<
  | { ok: true; userId: string; returnOrigin: string }
  | { ok: false; error: string }
> {
  const { clientSecret } = requireClientCreds();
  const [body, sig] = state.split(".");
  if (!body || !sig) return { ok: false, error: "Invalid OAuth state" };
  const expected = await hmacSha256(body, clientSecret);
  if (sig !== expected) return { ok: false, error: "Invalid OAuth state signature" };
  const parsed = JSON.parse(base64UrlDecode(body)) as {
    userId?: string;
    returnOrigin?: string;
    exp?: number;
  };
  if (!parsed.userId || !parsed.returnOrigin || !parsed.exp || parsed.exp < Date.now()) {
    return { ok: false, error: "OAuth state expired" };
  }
  return { ok: true, userId: parsed.userId, returnOrigin: parsed.returnOrigin };
}

function requireClientCreds() {
  const clientId = (process.env.GOOGLE_OAUTH_CLIENT_ID ?? "").trim();
  const clientSecret = (process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "").trim();
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials are not configured");
  }
  return { clientId, clientSecret };
}

function buildRawEmail(opts: {
  to: string;
  subject: string;
  body: string;
  from?: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const headers = [
    `To: ${opts.to}`,
    opts.from ? `From: ${opts.from}` : null,
    `Subject: ${opts.subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    opts.inReplyTo ? `In-Reply-To: ${opts.inReplyTo}` : null,
    opts.references ? `References: ${opts.references}` : null,
  ]
    .filter(Boolean)
    .join("\r\n");
  const msg = `${headers}\r\n\r\n${opts.body}`;
  return btoa(unescape(encodeURIComponent(msg)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Build the Google consent URL for this user. */
export const startGmailConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ origin: z.string().url().optional() }).parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    try {
      const { clientId } = requireClientCreds();
      const returnOrigin = (data.origin ?? baseUrl()).trim();
      const redirectUri = gmailRedirectUri(returnOrigin);
      const state = await signOAuthState({ userId: context.userId, returnOrigin });
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: GMAIL_SCOPES.join(" "),
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "true",
        state,
      });
      const authorizationUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;
      console.log("[gmail.startConnect] redirectUri:", redirectUri);
      console.log("[gmail.startConnect] authorizationUrl:", authorizationUrl);
      return { ok: true as const, authorizationUrl };
    } catch (e) {
      console.error("[gmail.startConnect]", e);
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "Could not start Gmail connection",
      };
    }
  });

/** Exchange the code, fetch the email address, persist tokens. */
export const completeGmailConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ code: z.string().min(1), state: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    try {
      const { clientId, clientSecret } = requireClientCreds();
      const verifiedState = await verifyOAuthState(data.state);
      if (!verifiedState.ok) return { ok: false as const, error: verifiedState.error };
      // Bind the OAuth callback to the same authenticated user that started it.
      if (verifiedState.userId !== context.userId) {
        return { ok: false as const, error: "OAuth state does not match the signed-in user" };
      }
      const redirectUri = gmailRedirectUri(verifiedState.returnOrigin);


      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: data.code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }).toString(),
      });
      const tokenText = await tokenRes.text();
      if (!tokenRes.ok) {
        console.error("[gmail.complete] token exchange failed", tokenRes.status, tokenText);
        return { ok: false as const, error: "Google token exchange failed" };
      }
      const tok = JSON.parse(tokenText) as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
        scope?: string;
        token_type?: string;
      };

      // Fetch email
      let email: string | null = null;
      const uRes = await fetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${tok.access_token}` },
      });
      if (uRes.ok) {
        const j = (await uRes.json()) as { email?: string };
        email = j.email ?? null;
      }

      const expiresAt = Date.now() + (tok.expires_in - 60) * 1000;
      await supabaseAdmin.from("connected_accounts").upsert(
        {
          user_id: verifiedState.userId,
          service: "gmail",
          connected: true,
          account_email: email,
          connection_id: null,
          connected_at: new Date().toISOString(),
          account_metadata: {
            access_token: tok.access_token,
            refresh_token: tok.refresh_token ?? null,
            expires_at: expiresAt,
            scope: tok.scope ?? GMAIL_SCOPES.join(" "),
          },
        },
        { onConflict: "user_id,service" },
      );
      return { ok: true as const, email, returnOrigin: verifiedState.returnOrigin };
    } catch (e) {
      console.error("[gmail.complete]", e);
      return { ok: false as const, error: "Could not finalize Gmail connection" };
    }
  });

export const disconnectGmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await supabaseAdmin
      .from("connected_accounts")
      .update({ connected: false, connection_id: null, account_metadata: {} })
      .eq("user_id", context.userId)
      .eq("service", "gmail");
    return { ok: true as const };
  });

export const getConnectedAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("connected_accounts")
      .select("id,user_id,service,connected,account_email,connected_at")
      .eq("user_id", context.userId);
    return { accounts: data ?? [] };
  });

/** Server-only: get a fresh access token, refreshing if needed. */
async function getFreshAccessToken(userId: string): Promise<
  | { ok: true; accessToken: string; email: string | null }
  | { ok: false; error: string }
> {
  const { data: acct } = await supabaseAdmin
    .from("connected_accounts")
    .select("account_email, account_metadata")
    .eq("user_id", userId)
    .eq("service", "gmail")
    .eq("connected", true)
    .maybeSingle();
  const meta = (acct?.account_metadata ?? {}) as {
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
  };
  if (!meta.access_token) return { ok: false, error: "Gmail not connected" };
  if (meta.expires_at && meta.expires_at > Date.now() + 5000) {
    return { ok: true, accessToken: meta.access_token, email: acct?.account_email ?? null };
  }
  if (!meta.refresh_token) {
    return { ok: false, error: "Gmail token expired and no refresh token" };
  }
  const { clientId, clientSecret } = requireClientCreds();
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: meta.refresh_token,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!res.ok) {
    console.error("[gmail.refresh] failed", res.status, await res.text().catch(() => ""));
    return { ok: false, error: "Could not refresh Gmail token" };
  }
  const t = (await res.json()) as { access_token: string; expires_in: number };
  const newExpires = Date.now() + (t.expires_in - 60) * 1000;
  await supabaseAdmin
    .from("connected_accounts")
    .update({
      account_metadata: { ...meta, access_token: t.access_token, expires_at: newExpires },
    })
    .eq("user_id", userId)
    .eq("service", "gmail");
  return { ok: true, accessToken: t.access_token, email: acct?.account_email ?? null };
}

/** Server-only: send an email via the user's Gmail. */
export async function sendGmailFor(opts: {
  userId: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
  threadId?: string;
  fromOverride?: string;
}): Promise<{ ok: true; messageId: string; threadId: string } | { ok: false; error: string }> {
  const tok = await getFreshAccessToken(opts.userId);
  if (!tok.ok) return tok;
  const raw = buildRawEmail({
    to: opts.to,
    subject: opts.subject,
    body: opts.body,
    from: opts.fromOverride ?? tok.email ?? undefined,
    inReplyTo: opts.inReplyTo,
    references: opts.references,
  });
  const res = await fetch(`${GMAIL_API}/users/me/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tok.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(opts.threadId ? { raw, threadId: opts.threadId } : { raw }),
  });
  if (!res.ok) {
    console.error("[gmail.send] failed", res.status, await res.text().catch(() => ""));
    return { ok: false, error: "Gmail send failed" };
  }
  const j = (await res.json()) as { id?: string; threadId?: string };
  if (!j.id || !j.threadId) return { ok: false, error: "Gmail send returned no id" };
  return { ok: true, messageId: j.id, threadId: j.threadId };
}

/** Server-only: fetch new replies in a thread (not from the user themself). */
export async function fetchThreadRepliesFor(opts: {
  userId: string;
  threadId: string;
}): Promise<
  | { ok: true; replies: Array<{ from: string; text: string; receivedAt: number }> }
  | { ok: false; error: string }
> {
  const tok = await getFreshAccessToken(opts.userId);
  if (!tok.ok) return tok;
  const res = await fetch(`${GMAIL_API}/users/me/threads/${opts.threadId}?format=full`, {
    headers: { Authorization: `Bearer ${tok.accessToken}` },
  });
  if (!res.ok) return { ok: false, error: "Could not fetch thread" };
  const j = (await res.json()) as {
    messages?: Array<{
      payload?: {
        headers?: Array<{ name: string; value: string }>;
        parts?: Array<{ mimeType?: string; body?: { data?: string } }>;
        body?: { data?: string };
      };
      internalDate?: string;
    }>;
  };
  const myEmail = (tok.email ?? "").toLowerCase();
  const replies: Array<{ from: string; text: string; receivedAt: number }> = [];
  for (const m of j.messages ?? []) {
    const headers = m.payload?.headers ?? [];
    const from = headers.find((h) => h.name.toLowerCase() === "from")?.value ?? "";
    if (myEmail && from.toLowerCase().includes(myEmail)) continue;
    let text = "";
    const direct = m.payload?.body?.data;
    if (direct) text = atob(direct.replace(/-/g, "+").replace(/_/g, "/"));
    else {
      const part = m.payload?.parts?.find((p) => p.mimeType === "text/plain");
      if (part?.body?.data) {
        text = atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));
      }
    }
    replies.push({ from, text, receivedAt: Number(m.internalDate ?? "0") });
  }
  return { ok: true, replies };
}
