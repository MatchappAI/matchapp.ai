/**
 * Analytics overview for /dashboard/analytics.
 * Splits money into earned / pending / potential and adds outreach funnel
 * metrics (sent, replied, reply rate, deals closed).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAnalyticsOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [deals, matches, outreach] = await Promise.all([
      supabase
        .from("deals")
        .select("id,deal_value,status,escrow_status,invoice_status,created_at")
        .eq("user_id", userId),
      supabase
        .from("brand_matches")
        .select("id,status,estimated_deal_min,estimated_deal_max")
        .eq("user_id", userId),
      supabase
        .from("outreach_emails")
        .select("id,sent,sent_at,replied,reply_classification,bounced,opened,first_opened_at")
        .eq("user_id", userId),
    ]);

    const d = deals.data ?? [];
    const bm = matches.data ?? [];
    const oe = outreach.data ?? [];

    const earned = d
      .filter((x) => x.invoice_status === "paid")
      .reduce((s, x) => s + Number(x.deal_value ?? 0), 0);
    const pending = d
      .filter(
        (x) =>
          x.status !== "completed" &&
          x.status !== "cancelled" &&
          x.invoice_status !== "paid",
      )
      .reduce((s, x) => s + Number(x.deal_value ?? 0), 0);
    const potentialMin = bm
      .filter((x) => x.status !== "rejected" && x.status !== "paid")
      .reduce((s, x) => s + Number(x.estimated_deal_min ?? 0), 0);
    const potentialMax = bm
      .filter((x) => x.status !== "rejected" && x.status !== "paid")
      .reduce((s, x) => s + Number(x.estimated_deal_max ?? 0), 0);

    const sent = oe.filter((x) => x.sent).length;
    const opened = oe.filter((x) => x.opened).length;
    const replied = oe.filter(
      (x) => x.replied && x.reply_classification !== "bounce",
    ).length;
    const genuine = oe.filter((x) => x.reply_classification === "genuine").length;
    const bounced = oe.filter((x) => x.bounced).length;
    const replyRate = sent > 0 ? Math.round((replied / sent) * 100) : 0;
    const openRate = sent > 0 ? Math.round((opened / sent) * 100) : 0;

    const dealsClosed = d.filter((x) => x.invoice_status === "paid").length;
    const conversionRate = replied > 0 ? Math.round((dealsClosed / replied) * 100) : 0;

    return {
      money: { earned, pending, potentialMin, potentialMax },
      outreach: { sent, opened, replied, genuine, bounced, replyRate, openRate },
      pipeline: { activeMatches: bm.length, dealsClosed, conversionRate },
    };
  });
