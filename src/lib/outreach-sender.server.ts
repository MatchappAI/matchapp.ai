/**
 * Compatibility wrapper for legacy outreach callers.
 *
 * Creator outreach must use the internal MatchAI email model and its selected
 * transport adapter. No transport is selected today, and Resend must never be
 * used as an implicit fallback (it is reserved for MatchAI product email).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getCreatorEmailTransport } from "@/lib/creator-email-transport.server";

const db = supabaseAdmin as unknown as SupabaseClient;

export type SendProvider = string;

export type SendOutreachInput = {
  userId: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
  threadId?: string;
  provider?: SendProvider;
  outreachId?: string;
  trackingId?: string;
  autonomyLevel?: number;
};

export type SendOutreachResult =
  | { ok: true; provider: SendProvider; messageId: string; threadId: string }
  | { ok: false; error: string };

export async function sendOutreach(input: SendOutreachInput): Promise<SendOutreachResult> {
  const transport = getCreatorEmailTransport();
  if (!transport.configured) {
    return {
      ok: false,
      error: "Creator email delivery is not configured. The draft was not sent.",
    };
  }
  const { data: identity } = await db
    .from("email_identities")
    .select("address")
    .eq("user_id", input.userId)
    .maybeSingle();
  if (!identity?.address) {
    return {
      ok: false,
      error: "Internal MatchAI email identity is not initialized.",
    };
  }
  const result = await transport.send({
    from: identity.address,
    to: [input.to],
    cc: [],
    bcc: [],
    replyTo: [],
    subject: input.subject,
    body: input.body,
    providerThreadId: input.threadId,
    inReplyTo: input.inReplyTo,
    references: input.references,
    attachments: [],
    idempotencyKey: crypto.randomUUID(),
  });
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    provider: transport.provider ?? "configured",
    messageId: result.providerMessageId,
    threadId: result.providerThreadId,
  };
}
