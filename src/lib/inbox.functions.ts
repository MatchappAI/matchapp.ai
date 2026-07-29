import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { FREE_INBOUND_THREAD_LIMIT } from "./pricing-config";
import { resolvePlan } from "./plans";

export type InboxThreadSummary = {
  brand_match_id: string;
  brand_name: string;
  brand_industry: string | null;
  fit_score: number | null;
  estimated_deal_min: number | null;
  estimated_deal_max: number | null;
  stage: string;
  stage_label: string;
  last_activity_at: string;
  last_activity_kind: string;
  last_activity_preview: string;
  unread_reply: boolean;
  event_count: number;
  has_deal: boolean;
  deal_value: number | null;
  invoice_status: string | null;
  /** Creator brought this brand in themselves (not sourced by MatchAI). */
  is_inbound: boolean;
  /** True when this inbound thread is beyond the free-plan cap and locked. */
  locked: boolean;
};

export type InboxEvent =
  | {
      kind: "outreach_draft";
      id: string;
      at: string;
      subject: string;
      body: string;
      to_email: string | null;
    }
  | {
      kind: "outreach_sent";
      id: string;
      at: string;
      subject: string;
      body: string;
      to_email: string | null;
      opened: boolean;
      open_count: number;
    }
  | {
      kind: "reply_received";
      id: string;
      at: string;
      outreach_id: string;
      reply_text: string;
      classification: string | null;
    }
  | {
      kind: "negotiation";
      id: string;
      at: string;
      stage: string;
      current_counter: number | null;
      next_action: string | null;
    }
  | {
      kind: "deal_created";
      id: string;
      at: string;
      deal_value: number | null;
      package_name: string | null;
    }
  | {
      kind: "contract";
      id: string;
      at: string;
      status: string;
    }
  | {
      kind: "escrow";
      id: string;
      at: string;
      status: string;
    }
  | {
      kind: "invoice";
      id: string;
      at: string;
      status: string;
      amount: number | null;
    };

function stageFromMatch(status: string) {
  if (status === "new") return { key: "matched", label: "Matched" };
  if (status === "pitched") return { key: "outreach_sent", label: "Pitch sent" };
  if (status === "replied") return { key: "interested", label: "Reply in" };
  if (status === "negotiating") return { key: "negotiating", label: "Negotiating" };
  if (status === "rejected") return { key: "rejected", label: "Passed" };
  return { key: "matched", label: "Matched" };
}

function stageFromDeal(d: {
  contract_status: string;
  escrow_status: string;
  invoice_status: string;
}) {
  if (d.invoice_status === "paid") return { key: "paid", label: "Paid" };
  if (d.invoice_status === "invoiced") return { key: "invoiced", label: "Invoiced" };
  if (d.escrow_status === "funded") return { key: "funded", label: "Funds secured" };
  if (d.escrow_status === "requested") return { key: "escrow_pending", label: "Awaiting funds" };
  if (d.contract_status === "sent") return { key: "contract_sent", label: "Contract sent" };
  if (d.contract_status === "drafted") return { key: "contract_drafted", label: "Contract drafted" };
  return { key: "negotiating", label: "Negotiating" };
}

export const listInboxThreads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [matchesRes, outreachRes, dealsRes, profileRes] = await Promise.all([
      supabase
        .from("brand_matches")
        .select(
          "id,brand_name,brand_industry,fit_score,fit_quality_score,estimated_deal_min,estimated_deal_max,status,data_source,created_at",
        )
        .eq("user_id", userId)
        .neq("status", "rejected")
        .order("created_at", { ascending: false }),
      supabase
        .from("outreach_emails")
        .select(
          "id,brand_match_id,subject,body,to_email,sent,sent_at,opened,open_count,replied,brand_reply_text,reply_classification,reply_classified_at,read_at,created_at",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("deals")
        .select(
          "id,brand_match_id,brand_name,deal_value,package_name,contract_status,escrow_status,invoice_status,status,created_at,updated_at",
        )
        .eq("user_id", userId),
      supabase.from("profiles").select("plan").eq("user_id", userId).maybeSingle(),
    ]);

    const matches = matchesRes.data ?? [];
    const outreaches = outreachRes.data ?? [];
    const deals = dealsRes.data ?? [];
    const plan = resolvePlan(profileRes.data?.plan);
    const isFree = plan.slug === "free";

    const byMatch = new Map<string, InboxThreadSummary>();
    for (const m of matches) {
      const st = stageFromMatch(m.status);
      const isInbound = m.data_source !== "real_ai_match";
      byMatch.set(m.id, {
        brand_match_id: m.id,
        brand_name: m.brand_name,
        brand_industry: m.brand_industry,
        fit_score: (m.fit_quality_score ?? m.fit_score) as number | null,
        estimated_deal_min: m.estimated_deal_min,
        estimated_deal_max: m.estimated_deal_max,
        stage: st.key,
        stage_label: st.label,
        last_activity_at: m.created_at,
        last_activity_kind: "matched",
        last_activity_preview: "New match added",
        unread_reply: false,
        event_count: 1,
        has_deal: false,
        deal_value: null,
        invoice_status: null,
        is_inbound: isInbound,
        locked: false,
      });
    }

    for (const o of outreaches) {
      if (!o.brand_match_id) continue;
      const t = byMatch.get(o.brand_match_id);
      if (!t) continue;
      t.event_count += 1;
      if (o.sent && o.sent_at) {
        if (o.sent_at > t.last_activity_at) {
          t.last_activity_at = o.sent_at;
          t.last_activity_kind = "outreach_sent";
          t.last_activity_preview = `You sent: ${o.subject}`;
        }
      }
      if (o.replied && o.brand_reply_text) {
        t.event_count += 1;
        const at = o.reply_classified_at ?? o.sent_at ?? o.created_at;
        if (at && at > t.last_activity_at) {
          t.last_activity_at = at;
          t.last_activity_kind = "reply_received";
          t.last_activity_preview = `Reply: ${o.brand_reply_text.slice(0, 90)}`;
        }
        if (!o.read_at) t.unread_reply = true;
      }
    }

    for (const d of deals) {
      const key =
        d.brand_match_id ??
        [...byMatch.values()].find((t) => t.brand_name === d.brand_name)?.brand_match_id;
      if (!key) continue;
      const t = byMatch.get(key);
      if (!t) continue;
      t.has_deal = true;
      t.deal_value = d.deal_value ?? t.deal_value;
      t.invoice_status = d.invoice_status;
      const st = stageFromDeal(d);
      t.stage = st.key;
      t.stage_label = st.label;
      const at = d.updated_at ?? d.created_at;
      if (at > t.last_activity_at) {
        t.last_activity_at = at;
        t.last_activity_kind = "deal";
        t.last_activity_preview = st.label;
      }
      t.event_count += 1;
    }

    const threads = [...byMatch.values()].sort((a, b) =>
      a.last_activity_at < b.last_activity_at ? 1 : -1,
    );

    // Apply free-plan inbound cap: keep the N most-recently-active inbound
    // threads unlocked; lock the rest so upgrade prompts fire in the UI.
    let inboundTotal = 0;
    let inboundLocked = 0;
    if (isFree) {
      let unlocked = 0;
      // threads is already sorted by last_activity_at desc
      for (const t of threads) {
        if (!t.is_inbound) continue;
        inboundTotal += 1;
        if (unlocked < FREE_INBOUND_THREAD_LIMIT) {
          unlocked += 1;
        } else {
          t.locked = true;
          inboundLocked += 1;
        }
      }
    } else {
      inboundTotal = threads.filter((t) => t.is_inbound).length;
    }

    return {
      threads,
      plan: plan.slug,
      inbound: {
        total: inboundTotal,
        limit: isFree ? FREE_INBOUND_THREAD_LIMIT : null,
        locked: inboundLocked,
      },
    };
  });

const ThreadSchema = z.object({ brand_match_id: z.string().uuid() });

export const getInboxThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ThreadSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { brand_match_id } = data;

    const [brandRes, outreachRes, dealsRes, negRes] = await Promise.all([
      supabase
        .from("brand_matches")
        .select("*")
        .eq("user_id", userId)
        .eq("id", brand_match_id)
        .maybeSingle(),
      supabase
        .from("outreach_emails")
        .select(
          "id,subject,body,to_email,sent,sent_at,opened,open_count,replied,brand_reply_text,reply_classification,reply_classified_at,read_at,created_at",
        )
        .eq("user_id", userId)
        .eq("brand_match_id", brand_match_id)
        .order("created_at", { ascending: true }),
      supabase
        .from("deals")
        .select("*")
        .eq("user_id", userId)
        .eq("brand_match_id", brand_match_id)
        .order("created_at", { ascending: true }),
      supabase
        .from("negotiations")
        .select("id,stage,current_counter,next_recommended_action,updated_at,created_at")
        .eq("user_id", userId)
        .eq("brand_match_id", brand_match_id)
        .order("created_at", { ascending: true }),
    ]);

    const brand = brandRes.data;
    if (!brand) return { brand: null, events: [] as InboxEvent[] };

    const events: InboxEvent[] = [];
    for (const o of outreachRes.data ?? []) {
      if (o.sent && o.sent_at) {
        events.push({
          kind: "outreach_sent",
          id: o.id,
          at: o.sent_at,
          subject: o.subject,
          body: o.body,
          to_email: o.to_email,
          opened: !!o.opened,
          open_count: o.open_count ?? 0,
        });
      } else {
        events.push({
          kind: "outreach_draft",
          id: o.id,
          at: o.created_at,
          subject: o.subject,
          body: o.body,
          to_email: o.to_email,
        });
      }
      if (o.replied && o.brand_reply_text) {
        events.push({
          kind: "reply_received",
          id: `${o.id}-reply`,
          outreach_id: o.id,
          at: o.reply_classified_at ?? o.sent_at ?? o.created_at,
          reply_text: o.brand_reply_text,
          classification: o.reply_classification,
        });
      }
    }
    for (const n of negRes.data ?? []) {
      events.push({
        kind: "negotiation",
        id: n.id,
        at: n.updated_at ?? n.created_at,
        stage: n.stage,
        current_counter: n.current_counter,
        next_action: n.next_recommended_action,
      });
    }
    for (const d of dealsRes.data ?? []) {
      events.push({
        kind: "deal_created",
        id: d.id,
        at: d.created_at,
        deal_value: d.deal_value,
        package_name: d.package_name,
      });
      if (d.contract_status && d.contract_status !== "none") {
        events.push({
          kind: "contract",
          id: `${d.id}-contract`,
          at: d.updated_at ?? d.created_at,
          status: d.contract_status,
        });
      }
      if (d.escrow_status && d.escrow_status !== "none") {
        events.push({
          kind: "escrow",
          id: `${d.id}-escrow`,
          at: d.updated_at ?? d.created_at,
          status: d.escrow_status,
        });
      }
      if (d.invoice_status && d.invoice_status !== "none") {
        events.push({
          kind: "invoice",
          id: `${d.id}-invoice`,
          at: d.updated_at ?? d.created_at,
          status: d.invoice_status,
          amount: d.deal_value,
        });
      }
    }

    events.sort((a, b) => (a.at < b.at ? -1 : 1));

    // Mark unread replies as read
    const unread = (outreachRes.data ?? []).filter((o) => o.replied && !o.read_at);
    if (unread.length) {
      await supabase
        .from("outreach_emails")
        .update({ read_at: new Date().toISOString() })
        .in(
          "id",
          unread.map((o) => o.id),
        );
    }

    return { brand, events };
  });
