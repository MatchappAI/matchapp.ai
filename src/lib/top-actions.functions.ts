import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Stage-aware "Top 5 Next Actions" rail for the MatchAI chat.
 *
 * Rules:
 *  - Always returns exactly 5 actions (padded from a growth bucket).
 *  - Max 3 actions of the same `kind` so one bucket can't dominate.
 *  - Ranked by where the creator is in the journey toward a paid deal:
 *      verify → brand kit → rates → find brands → approve →
 *      send → follow-up → reply → propose → contract → deliverable → paid → growth.
 */

export type ActionKind =
  | "verify"
  | "brandkit"
  | "rates"
  | "brands"
  | "approve"
  | "outreach"
  | "followup"
  | "reply"
  | "propose"
  | "contract"
  | "deliverable"
  | "growth";

export type TopAction = {
  label: string;
  prompt: string;
  kind: ActionKind;
  priority: number;
};

const MAX_PER_KIND = 3;
const TOTAL = 5;

export const getTopActions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ currentPage: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const userId = context.userId;
    const page = data.currentPage;

    const [profile, pricing, brands, approvals, outreach, deals, contracts, deliverables] =
      await Promise.all([
        supabaseAdmin
          .from("creator_profiles")
          .select("verified, verification_status, niche, primary_platform, full_name")
          .eq("user_id", userId)
          .maybeSingle(),
        supabaseAdmin
          .from("pricing_rules")
          .select("configured, rate_floor, target_rate")
          .eq("user_id", userId)
          .maybeSingle(),
        supabaseAdmin
          .from("brand_matches")
          .select("id, brand_name, fit_score, status")
          .eq("user_id", userId)
          .order("fit_score", { ascending: false })
          .limit(20),
        supabaseAdmin
          .from("approvals")
          .select("id, brand_name, approval_type, amount, status, created_at")
          .eq("user_id", userId)
          .eq("status", "pending")
          .order("created_at", { ascending: true })
          .limit(10),
        supabaseAdmin
          .from("outreach_emails")
          .select(
            "id, to_email, sent, replied, bounced, cancelled, scheduled_for, sent_at, brand_match_id",
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabaseAdmin
          .from("deals")
          .select("id, brand_name, status, invoice_status, contract_status, deal_value")
          .eq("user_id", userId)
          .neq("status", "completed")
          .limit(20),
        supabaseAdmin
          .from("contracts")
          .select("id, brand_name, status")
          .eq("user_id", userId)
          .in("status", ["draft", "sent"])
          .limit(10),
        supabaseAdmin
          .from("deliverables")
          .select("id, brand_name, status, post_date")
          .eq("user_id", userId)
          .in("status", ["pending", "revision"])
          .limit(10),
      ]);

    const isVerified = !!profile.data?.verified;
    const hasNiche = !!profile.data?.niche;
    const hasRateFloor = !!(pricing.data?.configured && pricing.data.rate_floor);
    const matches = brands.data ?? [];
    const newMatches = matches.filter((b) => b.status === "new" || b.status === "pending");
    const topBrand = matches[0];

    const pendingApprovals = approvals.data ?? [];

    const outreachList = outreach.data ?? [];
    const activeOutreach = outreachList.filter((o) => !o.cancelled);
    const sentOutreach = activeOutreach.filter((o) => o.sent && !o.bounced);
    const notYetSent = activeOutreach.filter((o) => !o.sent);
    const sentNoReply = sentOutreach.filter((o) => !o.replied);

    const activeDeals = deals.data ?? [];

    const openContracts = contracts.data ?? [];
    const pendingDeliverables = deliverables.data ?? [];

    // Build candidate pool. Priority: higher = more urgent.
    const c: TopAction[] = [];

    // ---- Setup gates (blockers that prevent getting paid) ----
    if (!isVerified) {
      c.push({
        kind: "verify",
        priority: 100,
        label: "Let's verify you (60 sec)",
        prompt:
          "Walk me through verifying my primary platform right now — one question at a time so I can get it done in 60 seconds.",
      });
    }
    if (!hasNiche) {
      c.push({
        kind: "brandkit",
        priority: 95,
        label: "Build your brand kit with me",
        prompt:
          "Generate my brand kit — niche, audience, tone, content pillars, and a 3-line pitch — from what you already know about me. Show it for approval.",
      });
    }
    if (!hasRateFloor) {
      c.push({
        kind: "rates",
        priority: 90,
        label: "Lock in your rates",
        prompt:
          "Recommend a smart rate floor, target rate, and walk-away rate based on my niche, platform, and audience. Explain your math in one paragraph.",
      });
    }
    // ---- Replies (highest revenue urgency once setup exists) ----
    pendingApprovals.slice(0, 3).forEach((a, i) => {
      const who = a.brand_name ?? "a brand";
      c.push({
        kind: "reply",
        priority: 85 - i,
        label: `Write back to ${who}`,
        prompt: `Open the pending ${a.approval_type ?? "reply"} from ${who} and draft my response in my voice — factor in my rate floor. Show it for approval before sending.`,
      });
    });

    // ---- Deal money-flow actions ----
    openContracts.slice(0, 2).forEach((k, i) => {
      c.push({
        kind: "contract",
        priority: 76 - i,
        label: `${k.status === "sent" ? "Nudge" : "Wrap up"} ${k.brand_name ?? "the contract"}`,
        prompt: `${k.status === "sent" ? "Chase" : "Finalize"} the ${k.status} contract with ${k.brand_name ?? "the brand"} — draft the message and show it for approval.`,
      });
    });

    // ---- Deliverables ----
    pendingDeliverables.slice(0, 2).forEach((d, i) => {
      c.push({
        kind: "deliverable",
        priority: 72 - i,
        label: `Ship the ${d.brand_name ?? "deliverable"} post`,
        prompt: `Help me finish the ${d.status} deliverable for ${d.brand_name ?? "this brand"} — draft the caption, confirm the post date, and prep proof-of-post.`,
      });
    });

    // ---- Approvals (outreach not yet sent) ----
    if (notYetSent.length > 0) {
      c.push({
        kind: "approve",
        priority: 70,
        label: `Review your ${Math.min(notYetSent.length, 5)} draft${notYetSent.length === 1 ? "" : "s"} with me`,
        prompt: `Open my ${notYetSent.length} pitch draft${notYetSent.length === 1 ? "" : "s"} one at a time. For each: summarize the brand, show the personalization, and let me approve, edit, or skip.`,
      });
    }

    // ---- Brand discovery / outreach ----
    if (matches.length === 0) {
      c.push({
        kind: "brands",
        priority: 68,
        label: "Find your first 10 brand fits",
        prompt: `Find my first 10 brand matches — fit-scored against my niche, audience, and rate floor. Rank by fastest-to-cash and tell me which to pitch first.`,
      });
    } else if (newMatches.length > 0 && topBrand) {
      c.push({
        kind: "outreach",
        priority: 66,
        label: `Pitch ${topBrand.brand_name} — I'll draft it`,
        prompt: `Draft outreach to ${topBrand.brand_name} now — short, personal, ready to send. Show the draft for my approval.`,
      });
      if (newMatches.length >= 3) {
        const top3 = newMatches
          .slice(0, 3)
          .map((b) => b.brand_name)
          .join(", ");
        c.push({
          kind: "outreach",
          priority: 64,
          label: `Pitch your top 3`,
          prompt: `Draft outreach to ${top3} — personalized for each. Show all three for approval before anything sends.`,
        });
      }
    }

    // ---- Follow-ups on silent sends ----
    if (sentNoReply.length >= 2) {
      c.push({
        kind: "followup",
        priority: 60,
        label: `Warm follow-up for ${sentNoReply.length} quiet brands`,
        prompt: `Draft warm follow-ups for the ${sentNoReply.length} brands who haven't replied yet. Different angle for each — show them for approval.`,
      });
    }

    // ---- Growth / always-available fillers ----
    c.push({
      kind: "growth",
      priority: 30,
      label: "Find more brands like you",
      prompt:
        "Find 10 more brand matches that fit my niche and rate floor. Add the top ones and tell me which to pitch first and why.",
    });
    c.push({
      kind: "growth",
      priority: 28,
      label: "Show me what's working",
      prompt:
        "Plain-English breakdown: which niches, subject lines, and price points are converting best for me, and what should I change this week?",
    });
    c.push({
      kind: "growth",
      priority: 26,
      label: "Time to raise your rates?",
      prompt:
        "Should I raise my rates 10%? Look at my reply and close rates, then recommend a specific new rate floor and target with a one-line justification.",
    });
    c.push({
      kind: "growth",
      priority: 24,
      label: "Just run it all for me",
      prompt:
        "Take the wheel — find best-fit brands, draft outreach in my voice, queue follow-ups, and keep the payment story external. Narrate each step here and stop for approval before anything sends or a material status changes.",
    });
    c.push({
      kind: "growth",
      priority: 22,
      label: "What can you actually do?",
      prompt:
        "In 4 short sentences, tell me exactly what you can do for me end-to-end — with real examples from my account.",
    });

    // ---- Page nudges: small boost so the current-tab action floats ----
    const bump = (kind: ActionKind, by = 6) => {
      for (const x of c) if (x.kind === kind) x.priority += by;
    };
    if (page.includes("/dashboard/brands")) {
      bump("outreach");
      bump("brands");
    } else if (page.includes("/dashboard/approvals")) {
      bump("reply");
      bump("approve");
    } else if (page.includes("/dashboard/deals")) {
      bump("contract");
      bump("deliverable");
    } else if (page.includes("/dashboard/campaigns")) {
      bump("outreach");
      bump("approve");
    } else if (page.includes("/dashboard/settings")) {
      bump("rates");
      bump("brandkit");
    }

    // Sort by priority desc, then apply max-per-kind cap, then take 5.
    c.sort((a, b) => b.priority - a.priority);
    const perKind = new Map<ActionKind, number>();
    const picked: TopAction[] = [];
    for (const item of c) {
      const used = perKind.get(item.kind) ?? 0;
      if (used >= MAX_PER_KIND) continue;
      picked.push(item);
      perKind.set(item.kind, used + 1);
      if (picked.length >= TOTAL) break;
    }
    // Guarantee 5: if pool was thin, fall back to growth items already added.
    while (picked.length < TOTAL) {
      const filler = c.find((x) => !picked.includes(x));
      if (!filler) break;
      picked.push(filler);
    }

    return { actions: picked.slice(0, TOTAL) };
  });
