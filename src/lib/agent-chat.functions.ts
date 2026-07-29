import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendOutreach } from "./outreach-sender.server";

export const loadAgentMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("agent_messages")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(100);
    return { messages: data ?? [] };
  });

export const loadAgentPanel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const [profile, brands, deals, approvals, activity] = await Promise.all([
      supabaseAdmin
        .from("creator_profiles")
        .select("full_name, handle, primary_platform, niche, follower_count")
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("brand_matches")
        .select(
          "id, brand_name, brand_industry, fit_quality_score, fit_score, status, estimated_deal_min, estimated_deal_max",
        )
        .eq("user_id", userId)
        .order("fit_quality_score", { ascending: false, nullsFirst: false })
        .limit(5),
      supabaseAdmin
        .from("deals")
        .select("id, brand_name, status, deal_value, escrow_status, invoice_status")
        .eq("user_id", userId)
        .neq("status", "completed")
        .limit(5),
      supabaseAdmin
        .from("approvals")
        .select("id, approval_type, brand_name, amount")
        .eq("user_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5),
      supabaseAdmin
        .from("agent_activity")
        .select("id, activity_type, title, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(6),
    ]);
    return {
      profile: profile.data,
      brands: brands.data ?? [],
      deals: deals.data ?? [],
      approvals: approvals.data ?? [],
      activity: activity.data ?? [],
    };
  });

export const loadOnboardingMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("onboarding_messages")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });
    return { messages: data ?? [] };
  });

export const clearAgentChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await supabaseAdmin.from("agent_messages").delete().eq("user_id", context.userId);
    return { ok: true as const };
  });

const OpenOutreachDraftSchema = z.object({
  outreachId: z.string().uuid(),
  approvalId: z.string().uuid().nullable().optional(),
  brandName: z.string().nullable().optional(),
});

export const openOutreachDraftInChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OpenOutreachDraftSchema.parse(input))
  .handler(async ({ context, data }) => {
    const userId = context.userId;
    const { data: outreach } = await supabaseAdmin
      .from("outreach_emails")
      .select("id, brand_match_id, to_email, subject, body, ai_reason, personalization_used, sent")
      .eq("id", data.outreachId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!outreach) return { ok: false as const, error: "Draft not found" };

    const [{ data: brand }, { data: approval }, { data: existingRows }] = await Promise.all([
      outreach.brand_match_id
        ? supabaseAdmin
            .from("brand_matches")
            .select("brand_name")
            .eq("id", outreach.brand_match_id)
            .eq("user_id", userId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      data.approvalId
        ? Promise.resolve({ data: { id: data.approvalId } })
        : supabaseAdmin
            .from("approvals")
            .select("id")
            .eq("user_id", userId)
            .eq("related_id", outreach.id)
            .eq("approval_type", "outreach_draft")
            .maybeSingle(),
      supabaseAdmin
        .from("agent_messages")
        .select("*")
        .eq("user_id", userId)
        .eq("inline_card_type", "outreach_review")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const existing = (existingRows ?? []).find((row) => {
      const card = row.inline_card_data as { outreachId?: string } | null;
      return card?.outreachId === outreach.id;
    });
    if (existing) return { ok: true as const, message: existing };

    let contact: {
      email: string | null;
      name: string | null;
      title: string | null;
      source: string | null;
      confidence: string | null;
    } | null = null;
    if (outreach.brand_match_id) {
      const { getBestContactEmail } = await import("./brand-contacts.functions");
      contact = await getBestContactEmail(outreach.brand_match_id);
    }

    const brandName = data.brandName ?? brand?.brand_name ?? "Brand";
    const { data: message, error } = await supabaseAdmin
      .from("agent_messages")
      .insert({
        user_id: userId,
        role: "assistant",
        content: `Opened your pitch to ${brandName} — you can review, edit, copy, or mark it sent right here.`,
        requires_approval: !outreach.sent,
        approval_status: outreach.sent ? "executed" : "pending",
        action_triggered: "send_outreach",
        inline_card_type: "outreach_review",
        inline_card_data: {
          outreachId: outreach.id,
          approvalId: approval?.id ?? null,
          brand_name: brandName,
          to_email: outreach.to_email ?? contact?.email ?? "",
          contact_name: contact?.name ?? null,
          contact_title: contact?.title ?? null,
          contact_source: contact?.source ?? null,
          contact_confidence: contact?.confidence ?? null,
          subject: outreach.subject,
          subject_variants: [],
          body: outreach.body,
          personalization_used: outreach.personalization_used ?? null,
          signals_structured: [],
          send_time_suggestion: null,
          ai_reason: outreach.ai_reason ?? null,
        },
      })
      .select("*")
      .single();

    if (error || !message) return { ok: false as const, error: "Could not open draft in chat" };
    return { ok: true as const, message };
  });

const LANDING_BRIDGE_MARKER = "[[landing-handoff]]";

/**
 * Imports the visitor's pre-signup landing chat transcript into
 * agent_messages so the dashboard chat continues the same conversation
 * with full context. Idempotent — bails if a bridge marker already exists.
 */
export const importLandingChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        messages: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              text: z.string().min(1).max(4000),
            }),
          )
          .max(60),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const userId = context.userId;

    // Idempotent: skip if we've already handed off for this user.
    const { data: existing } = await supabaseAdmin
      .from("agent_messages")
      .select("id")
      .eq("user_id", userId)
      .like("content", `${LANDING_BRIDGE_MARKER}%`)
      .limit(1);
    if (existing && existing.length > 0) return { imported: 0 };

    if (!data.messages.length) return { imported: 0 };

    // Keep only the substantive turns — trim the canned greeting.
    const cleaned = data.messages.filter((m) => m.text.trim().length > 0).slice(-30);

    // 1) An assistant-visible "picking up where we left off" line.
    // 2) A hidden context row (marker-prefixed) capturing the transcript so
    //    the model reasons over the full landing conversation on its next turn.
    const transcript = cleaned
      .map((m) => `${m.role === "user" ? "Creator" : "MatchAI"}: ${m.text}`)
      .join("\n");

    const rows = [
      {
        user_id: userId,
        role: "assistant" as const,
        content: `${LANDING_BRIDGE_MARKER} Prior landing-page conversation between MatchAI and this creator (use as full context; do not repeat back verbatim):\n${transcript}`,
      },
      {
        user_id: userId,
        role: "assistant" as const,
        content:
          "Picking up right where we left off from the landing page 👋 I've got everything we already talked about — let's turn that into your first paid brand deal.",
      },
    ];

    await supabaseAdmin.from("agent_messages").insert(rows);
    return { imported: cleaned.length };
  });

/**
 * The ONLY path that executes consequential actions. Reads the approval card
 * stored on a prior agent_messages row, performs the action, then writes a
 * confirmation message back into the chat.
 */
export const approveAndExecute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ messageId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { data: msg } = await supabaseAdmin
      .from("agent_messages")
      .select("*")
      .eq("id", data.messageId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!msg) return { ok: false as const, error: "Message not found" };
    if (!msg.requires_approval) return { ok: false as const, error: "Not approvable" };
    if (msg.approval_status === "executed") return { ok: false as const, error: "Already done" };

    const action = msg.action_triggered as string | null;
    const params = (msg.inline_card_data ?? {}) as Record<string, unknown>;
    let result: Record<string, unknown> = {};
    let confirmation = "";

    try {
      switch (action) {
        case "send_outreach": {
          const outreachId = params.outreachId as string | undefined;
          if (!outreachId) throw new Error("Missing outreachId");
          const { data: o } = await supabaseAdmin
            .from("outreach_emails")
            .select("*, brand_matches(brand_name)")
            .eq("id", outreachId)
            .eq("user_id", userId)
            .maybeSingle();
          if (!o) throw new Error("Outreach not found");
          if (!o.to_email) throw new Error("No recipient email set");
          const send = await sendOutreach({
            userId,
            to: o.to_email,
            subject: o.subject,
            body: o.body,
          });
          if (!send.ok) throw new Error(send.error);
          await supabaseAdmin
            .from("outreach_emails")
            .update({
              sent: true,
              sent_at: new Date().toISOString(),
              gmail_message_id: send.messageId,
              gmail_thread_id: send.threadId,
            })
            .eq("id", outreachId);
          // Auto-schedule follow-ups at +2, +5, +9 days. Auto-approved since
          // the creator just approved the initial send from chat. The cron
          // job cancels these automatically if the brand replies first.
          const days = [2, 5, 9];
          const scheduledRows = days.map((d, i) => {
            const dt = new Date();
            dt.setDate(dt.getDate() + d);
            return {
              user_id: userId,
              outreach_id: outreachId,
              sequence_number: i + 1,
              scheduled_at: dt.toISOString(),
              approved: true,
            };
          });
          await supabaseAdmin.from("follow_up_sequences").insert(scheduledRows);
          result = {
            messageId: send.messageId,
            threadId: send.threadId,
            followUpsScheduled: days.length,
          };
          confirmation = `Sent. I scheduled ${days.length} follow-ups (+2d, +5d, +9d) — they'll auto-cancel the moment the brand replies.`;
          break;
        }

        case "release_payment": {
          throw new Error(
            "This legacy action is retired. MatchAI never releases creator-brand payments.",
          );
        }
        case "request_escrow": {
          throw new Error(
            "This legacy action is retired. Creator-brand payments are handled externally.",
          );
        }
        case "approve_followups": {
          const outreachId = params.outreachId as string | undefined;
          if (!outreachId) throw new Error("Missing outreachId");
          await supabaseAdmin
            .from("follow_up_sequences")
            .update({ approved: true })
            .eq("outreach_id", outreachId)
            .eq("user_id", userId);
          confirmation = "Follow-up sequence approved. I'll send them on schedule.";
          break;
        }
        case "apply_insight": {
          const insightId = params.insightId as string | undefined;
          if (!insightId) throw new Error("Missing insightId");
          await supabaseAdmin
            .from("learning_insights")
            .update({ applied: true })
            .eq("id", insightId)
            .eq("user_id", userId);
          confirmation = "Applied. I'll prioritize this going forward.";
          break;
        }
        case "remember_preference": {
          const text = (params.text as string | undefined)?.trim();
          if (!text) throw new Error("Missing text");
          const { data: row } = await supabaseAdmin
            .from("creator_profiles")
            .select("agent_memory")
            .eq("user_id", userId)
            .maybeSingle();
          const list = Array.isArray(row?.agent_memory)
            ? (row.agent_memory as Array<{
                id: string;
                text: string;
                source?: string;
                created_at?: string;
              }>)
            : [];
          if (!list.some((m) => m.text.toLowerCase().trim() === text.toLowerCase())) {
            const entry = {
              id: crypto.randomUUID(),
              text,
              source: "chat",
              created_at: new Date().toISOString(),
            };
            await supabaseAdmin
              .from("creator_profiles")
              .update({ agent_memory: [entry, ...list].slice(0, 80) })
              .eq("user_id", userId);
          }
          confirmation = `Saved. I'll always remember: "${text}"`;
          break;
        }

        case "mark_delivered": {
          const dealId = params.dealId as string | undefined;
          if (!dealId) throw new Error("Missing dealId");
          await supabaseAdmin
            .from("deals")
            .update({ status: "completed" })
            .eq("id", dealId)
            .eq("user_id", userId);
          confirmation =
            "Marked delivered. When the brand confirms, payment releases automatically.";
          break;
        }

        case "file_dispute": {
          const dealId = params.dealId as string | undefined;
          const reason = (params.reason as string | undefined)?.trim();
          if (!dealId || !reason) throw new Error("Missing dispute details");
          const { data: tx } = await supabaseAdmin
            .from("escrow_transactions")
            .select("id")
            .eq("deal_id", dealId)
            .maybeSingle();
          if (tx) {
            await supabaseAdmin
              .from("escrow_transactions")
              .update({ dispute_status: "flagged", dispute_reason: reason })
              .eq("id", tx.id);
          }
          await supabaseAdmin
            .from("deals")
            .update({ status: "disputed" })
            .eq("id", dealId)
            .eq("user_id", userId);
          confirmation =
            "Flagged. Payment release is blocked while we look into it — you'll hear back within 1 business day.";
          break;
        }

        case "pause_campaign":
        case "resume_campaign": {
          const campaignId = params.campaignId as string | undefined;
          if (!campaignId) throw new Error("Missing campaignId");
          await supabaseAdmin
            .from("outreach_campaigns")
            .update({ active: action === "resume_campaign" })
            .eq("id", campaignId)
            .eq("user_id", userId);
          confirmation =
            action === "pause_campaign"
              ? "Paused. No new sends until you resume."
              : "Resumed. Outreach will send on schedule.";
          break;
        }

        case "update_rate": {
          const patch: Record<string, number> = {};
          if (typeof params.floor === "number") patch.rate_floor = params.floor as number;
          if (typeof params.target === "number") patch.target_rate = params.target as number;
          if (typeof params.walkaway === "number") patch.walk_away_rate = params.walkaway as number;
          if (Object.keys(patch).length === 0) throw new Error("Nothing to update");
          const { data: existing } = await supabaseAdmin
            .from("pricing_rules")
            .select("id")
            .eq("user_id", userId)
            .maybeSingle();
          if (existing) {
            await supabaseAdmin
              .from("pricing_rules")
              .update(patch as never)
              .eq("id", existing.id);
          } else {
            await supabaseAdmin
              .from("pricing_rules")
              .insert({ user_id: userId, ...patch } as never);
          }
          const parts = [
            patch.rate_floor !== undefined ? `floor $${patch.rate_floor.toLocaleString()}` : null,
            patch.target_rate !== undefined
              ? `target $${patch.target_rate.toLocaleString()}`
              : null,
            patch.walk_away_rate !== undefined
              ? `walkaway $${patch.walk_away_rate.toLocaleString()}`
              : null,
          ]
            .filter(Boolean)
            .join(", ");
          confirmation = `Updated pricing (${parts}). Every new draft will use these numbers.`;
          break;
        }

        case "connect_payout": {
          throw new Error(
            "This legacy action is retired. MatchAI does not connect or process creator payouts.",
          );
        }

        case "update_brief": {
          const campaignId = params.campaignId as string | undefined;
          const patch = (params.patch ?? {}) as Record<string, string | undefined>;
          if (!campaignId) throw new Error("Missing campaignId");
          const { data: existing } = await supabaseAdmin
            .from("outreach_campaigns")
            .select("brief")
            .eq("id", campaignId)
            .eq("user_id", userId)
            .maybeSingle();
          const merged = { ...((existing?.brief as Record<string, unknown>) ?? {}), ...patch };
          await supabaseAdmin
            .from("outreach_campaigns")
            .update({ brief: merged as never })
            .eq("id", campaignId)
            .eq("user_id", userId);
          confirmation = "Brief updated. New outreach in this campaign will use it right away.";
          break;
        }

        case "create_campaign": {
          const { name, objective, audience, budget, voice } = params as Record<string, string>;
          if (!name || !objective) throw new Error("Missing campaign name or objective");
          const brief = { objective, audience, budget, voice };
          const { data: row } = await supabaseAdmin
            .from("outreach_campaigns")
            .insert({ user_id: userId, name, active: true, brief: brief as never })
            .select("id")
            .single();
          result = { campaignId: row?.id ?? null };
          confirmation = `Campaign "${name}" is live. Say the word and I'll queue outreach for it.`;
          break;
        }

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : "Action failed";
      console.error("[approveAndExecute]", action, err);
      await supabaseAdmin
        .from("agent_messages")
        .update({ approval_status: "failed", action_result: { error: err } })
        .eq("id", data.messageId);
      await supabaseAdmin.from("agent_messages").insert({
        user_id: userId,
        role: "assistant",
        content: `I couldn't complete that — ${err}. Want to try again?`,
      });
      return { ok: false as const, error: err };
    }

    await supabaseAdmin
      .from("agent_messages")
      .update({ approval_status: "executed", action_result: result as never })
      .eq("id", data.messageId);
    await supabaseAdmin.from("agent_messages").insert({
      user_id: userId,
      role: "assistant",
      content: confirmation,
    });
    return { ok: true as const };
  });

export const declineApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ messageId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await supabaseAdmin
      .from("agent_messages")
      .update({ approval_status: "declined" })
      .eq("id", data.messageId)
      .eq("user_id", context.userId);
    await supabaseAdmin.from("agent_messages").insert({
      user_id: context.userId,
      role: "assistant",
      content: "Got it — I won't proceed.",
    });
    return { ok: true as const };
  });
