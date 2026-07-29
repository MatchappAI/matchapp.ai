/**
 * Outreach send abstraction.
 *
 * Transport: MatchAI's verified Resend domain (outreach@notify.www.matchapp.ai).
 * All replies route back to that address and into the MatchAI workspace, so
 * creators run every deal from a single on-platform inbox — no Gmail, no SMTP,
 * no provider connect required.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type SendProvider = "matchai";

export type SendOutreachInput = {
  userId: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
  threadId?: string;
  /** Ignored — kept for signature compatibility. */
  provider?: SendProvider;
  outreachId?: string;
  /** Tracking token (outreach_emails.tracking_id) for opens/clicks. */
  trackingId?: string;
  /** When the agent triggered this send: 0..3. Enables audit logging + autopilot caps. */
  autonomyLevel?: number;
};

export type SendOutreachResult =
  | { ok: true; provider: SendProvider; messageId: string; threadId: string }
  | { ok: false; error: string };

/** MatchAI-owned verified sending domain (Resend). */
const MATCHAI_SENDER_DOMAIN = "notify.www.matchapp.ai";
const MATCHAI_SENDER_LOCAL = "outreach";
const MATCHAI_SENDER_EMAIL = `${MATCHAI_SENDER_LOCAL}@${MATCHAI_SENDER_DOMAIN}`;

function publicOrigin(): string {
  return (
    process.env.PUBLIC_SITE_URL ??
    process.env.VITE_PUBLIC_SITE_URL ??
    "https://www.matchapp.ai"
  );
}

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildTrackedHtml(body: string, trackingId?: string): string {
  const origin = publicOrigin();
  const urlRe = /(https?:\/\/[^\s<>"']+)/g;
  let safe = htmlEscape(body).replace(/\r\n|\r|\n/g, "<br/>");
  if (trackingId) {
    safe = safe.replace(urlRe, (raw) => {
      const click = `${origin}/api/public/email/click/${trackingId}?u=${encodeURIComponent(raw)}`;
      return `<a href="${click}">${raw}</a>`;
    });
  }
  const pixel = trackingId
    ? `<img src="${origin}/api/public/email/open/${trackingId}.gif" width="1" height="1" alt="" style="border:0;display:block;width:1px;height:1px;" />`
    : "";
  return `<!doctype html><html><body>${safe}${pixel}</body></html>`;
}

async function sendViaResend(input: SendOutreachInput): Promise<SendOutreachResult> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return { ok: false, error: "Email sending is not configured yet." };
  }

  const toNorm = input.to.trim().toLowerCase();

  // 0) Demo safety — MatchAI must NEVER send real outreach to a demo brand
  // or a demo contact. Demo records exist purely as UI fallback.
  if (input.outreachId) {
    const { data: oe } = await supabaseAdmin
      .from("outreach_emails")
      .select("is_demo, brand_match_id")
      .eq("id", input.outreachId)
      .maybeSingle();
    if (oe?.is_demo) {
      return { ok: false, error: "This is a demo brand — real outreach is disabled." };
    }
    if (oe?.brand_match_id) {
      const { data: bm } = await supabaseAdmin
        .from("brand_matches")
        .select("is_demo")
        .eq("id", oe.brand_match_id)
        .maybeSingle();
      if (bm?.is_demo) {
        return { ok: false, error: "This is a demo brand — real outreach is disabled." };
      }
    }
  }

  // 1) Suppression list — never send to an address the creator (or a recipient)
  // has already added or unsubscribed.
  const { data: suppressed } = await supabaseAdmin
    .from("suppression_list")
    .select("id")
    .eq("user_id", input.userId)
    .eq("email", toNorm)
    .maybeSingle();
  if (suppressed?.id) {
    return { ok: false, error: "Recipient is on your suppression list." };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, display_name, physical_address, unsubscribe_footer_enabled, autopilot_daily_send_cap")
    .eq("user_id", input.userId)
    .maybeSingle();

  // 1b) Autopilot daily cap — only enforced when the agent triggered this send.
  if (input.autonomyLevel === 3) {
    const cap = profile?.autopilot_daily_send_cap ?? 25;
    if (cap > 0) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabaseAdmin
        .from("agent_audit_log")
        .select("id", { count: "exact", head: true })
        .eq("user_id", input.userId)
        .eq("action", "outreach.sent")
        .gte("created_at", since);
      if ((count ?? 0) >= cap) {
        return {
          ok: false,
          error: `Autopilot daily send cap reached (${cap}/day). Bump it in Settings if you want more.`,
        };
      }
    }
  }

  const senderName =
    (profile?.display_name ?? profile?.full_name ?? "").trim() || "MatchAI";
  const from = `${senderName} via MatchAI <${MATCHAI_SENDER_EMAIL}>`;

  // 2) CAN-SPAM footer: physical address + one-click unsubscribe URL.
  const footerEnabled = profile?.unsubscribe_footer_enabled !== false;
  const physical = (profile?.physical_address ?? "").trim();
  const origin = publicOrigin();
  const unsubUrl = input.trackingId
    ? `${origin}/unsubscribe?tid=${encodeURIComponent(input.trackingId)}`
    : `${origin}/unsubscribe?e=${encodeURIComponent(toNorm)}`;
  const footerText = footerEnabled
    ? `\n\n—\nYou received this because ${senderName} reached out to your public brand address.\nUnsubscribe: ${unsubUrl}${physical ? `\n${physical}` : ""}`
    : "";
  const bodyWithFooter = `${input.body}${footerText}`;


  const html = buildTrackedHtml(bodyWithFooter, input.trackingId);

  const listUnsub = `<${unsubUrl}>`;
  const headers: Record<string, string> = {
    "List-Unsubscribe": listUnsub,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
  if (input.inReplyTo) headers["In-Reply-To"] = input.inReplyTo;
  if (input.references) headers["References"] = input.references;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      reply_to: MATCHAI_SENDER_EMAIL,
      subject: input.subject,
      html,
      text: bodyWithFooter,
      headers,
      tags: input.trackingId
        ? [{ name: "tracking_id", value: input.trackingId }]
        : undefined,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[matchai-send] resend failed", res.status, text);
    return { ok: false, error: `Send failed (${res.status}).` };
  }
  const payload = (await res.json().catch(() => ({}))) as { id?: string };

  // Audit log: record every send when we know an autonomy level (agent-initiated).
  if (input.autonomyLevel !== undefined) {
    await supabaseAdmin.from("agent_audit_log").insert({
      user_id: input.userId,
      action: "outreach.sent",
      target_type: "outreach_email",
      target_id: input.outreachId ?? null,
      autonomy_level: input.autonomyLevel,
      metadata: { to: input.to, subject: input.subject, provider_message_id: payload.id ?? null },
    });
  }

  return {
    ok: true,
    provider: "matchai",
    messageId: payload.id ?? "",
    threadId: payload.id ?? "",
  };
}

export async function sendOutreach(
  input: SendOutreachInput,
): Promise<SendOutreachResult> {
  return sendViaResend(input);
}
