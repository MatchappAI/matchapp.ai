/**
 * Server-only analytics + error capture.
 *
 * Writes to `analytics_events` and `error_events` via service_role so
 * unauthenticated flows (webhooks, cron) can log too. Reads are admin-
 * gated by RLS. All calls are best-effort — a logging failure NEVER
 * blocks the caller.
 *
 * Event vocabulary (keep in sync with the funnel spec):
 *   signup, onboarding_completed, recommendations_generated,
 *   demo_fallback_triggered, recommendation_approved, recommendation_replaced,
 *   pitch_approved, pitch_edited, pitch_sent, delivered, bounced, opened,
 *   replied, positive_reply, wrong_contact, qualified_paid_interest,
 *   deal_created, deal_won, payment_completed, creator_payout_completed
 *
 * Error areas (keep in sync with the monitoring spec):
 *   recommendation_generation, contact_enrichment, email_send,
 *   webhook_processing, reply_classification, deal_creation, payment_update
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AnalyticsEvent =
  | "signup"
  | "onboarding_completed"
  | "recommendations_generated"
  | "demo_fallback_triggered"
  | "recommendation_approved"
  | "recommendation_replaced"
  | "pitch_approved"
  | "pitch_edited"
  | "pitch_sent"
  | "delivered"
  | "bounced"
  | "opened"
  | "replied"
  | "positive_reply"
  | "wrong_contact"
  | "qualified_paid_interest"
  | "deal_created"
  | "deal_won"
  | "payment_completed"
  | "creator_payout_completed";

export type ErrorArea =
  | "recommendation_generation"
  | "contact_enrichment"
  | "email_send"
  | "webhook_processing"
  | "reply_classification"
  | "deal_creation"
  | "payment_update";

export async function track(
  userId: string | null,
  event: AnalyticsEvent,
  properties: Record<string, unknown> = {},
): Promise<void> {
  try {
    await supabaseAdmin.from("analytics_events").insert({
      user_id: userId,
      event,
      properties: properties as never,
    });
  } catch (e) {
    // Never let logging fail the request.
    console.error("[analytics.track] failed", event, e);
  }
}

export async function captureError(
  area: ErrorArea,
  err: unknown,
  ctx: { userId?: string | null; [key: string]: unknown } = {},
): Promise<void> {
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err);
  try {
    await supabaseAdmin.from("error_events").insert({
      user_id: ctx.userId ?? null,
      area,
      message: message.slice(0, 2000),
      context: { ...ctx, stack: err instanceof Error ? err.stack?.slice(0, 4000) : undefined } as never,
    });
  } catch (e) {
    console.error("[analytics.captureError] failed", area, e);
  }
  // Always mirror to server logs so the developer can find it fast.
  console.error(`[${area}]`, message);
}

/** Log a demo-fallback occurrence for the admin dashboard. */
export async function logDemoFallback(args: {
  userId: string | null;
  reason: string;
  attemptedRealCount: number;
  fallbackCount: number;
}): Promise<void> {
  try {
    await supabaseAdmin.from("demo_fallback_events").insert({
      user_id: args.userId,
      reason: args.reason,
      attempted_real_count: args.attemptedRealCount,
      fallback_count: args.fallbackCount,
    });
    await track(args.userId, "demo_fallback_triggered", {
      reason: args.reason,
      attempted_real_count: args.attemptedRealCount,
      fallback_count: args.fallbackCount,
    });
  } catch (e) {
    console.error("[analytics.logDemoFallback] failed", e);
  }
}
