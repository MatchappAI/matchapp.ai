import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Returns a fresh page-aware opener for the dashboard chat panel.
 * Runs small Supabase queries — never hardcoded strings.
 */
export const getChatOpener = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ currentPage: z.string().min(1).max(120) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const userId = context.userId;
    const page = data.currentPage;

    const [profile, brands, approvals, deals, pricing, insights] = await Promise.all([
      supabaseAdmin
        .from("creator_profiles")
        .select("full_name, handle, primary_platform")
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("brand_matches")
        .select("id, brand_name, fit_score, status", { count: "exact" })
        .eq("user_id", userId)
        .order("fit_score", { ascending: false })
        .limit(3),
      supabaseAdmin
        .from("approvals")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "pending"),
      supabaseAdmin
        .from("deals")
        .select("id, brand_name, status, invoice_status")
        .eq("user_id", userId)
        .neq("status", "completed")
        .limit(10),
      supabaseAdmin
        .from("pricing_rules")
        .select("rate_floor, target_rate")
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("learning_insights")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("applied", false),
    ]);

    const name = profile.data?.full_name?.split(" ")[0] ?? "there";
    const pendingApprovals = approvals.count ?? 0;
    const topBrand = brands.data?.[0];
    const newInsights = insights.count ?? 0;

    type Suggestion = { label: string; prompt: string };
    const suggestions: Suggestion[] = [];
    const topName = topBrand?.brand_name;
    const top3 = (brands.data ?? []).slice(0, 3);
    const top3Names = top3.map((b) => b.brand_name).join(", ");

    let message: string | null;
    switch (true) {
      case page === "/dashboard": {
        // Always greet + explain what I do, so the user can lean back and
        // watch, or click into the right pane if they want to. The intro is
        // the same regardless of state; the follow-up line is context-aware.
        const hello = `Hey ${name} — I'm MatchAI, your personal brand-deal manager.`;
        const whatIDo = ` Here's what I do for you end-to-end: I find brands that fit your audience and rates, write personalized outreach in your voice, follow up on your behalf, and keep the inbox, drafts, and confirmations organized in one place. You can just stay in this chat and watch me work on the right — or jump into any tab yourself. Anything you want done, just ask.`;
        let nextLine: string;
        if (pendingApprovals > 0) {
          nextLine = ` Right now you've got ${pendingApprovals} brand ${pendingApprovals === 1 ? "reply" : "replies"} waiting — want me to open the first and draft your response?`;
          suggestions.push({
            label: `Open ${pendingApprovals} repl${pendingApprovals === 1 ? "y" : "ies"}`,
            prompt: `Open my ${pendingApprovals} pending approval${pendingApprovals === 1 ? "" : "s"} one by one — draft each response in my voice so I can approve or edit.`,
          });
        } else if (topName) {
          nextLine = ` Your strongest match right now is ${topName} at ${topBrand!.fit_score}% fit. Want me to draft a pitch you can send today?`;
        } else {
          nextLine = ` Want me to find your first 10 brand matches now so we can get things moving?`;
        }
        message = `${hello}${whatIDo}${nextLine}`;
        suggestions.push({
          label: "Just run everything",
          prompt: `Take the wheel — find my best-fit brands, draft outreach in my voice, queue follow-ups, and keep creator-brand payment tracking external. Narrate each step here as you go and stop for my approval before anything sends or a deal status changes.`,
        });
        if (topName)
          suggestions.push({
            label: `Pitch ${topName}`,
            prompt: `Draft outreach to ${topName} now — short, personal, ready to send. Show the draft for my approval.`,
          });
        else
          suggestions.push({
            label: "Find brand matches",
            prompt: `Find brand matches that fit my niche and rate floor. Add the top 10 and tell me which one to pitch first and why.`,
          });
        suggestions.push({
          label: "What can you do?",
          prompt: `In 4 short sentences, tell me exactly what you can do for me end-to-end — finding brands, writing outreach, organizing inbox threads, and follow-ups — with real examples from my account.`,
        });
        break;
      }
      case page === "/dashboard/brands":
        message = topName
          ? `I'm looking at your matches. ${topName} stands out at ${topBrand!.fit_score}% — want me to draft a pitch and show it here for approval?`
          : `Nothing here yet — want me to pull your first batch of brand matches?`;
        if (topName)
          suggestions.push({
            label: `Pitch ${topName}`,
            prompt: `Draft outreach to ${topName} now and show it for approval.`,
          });
        if (top3.length >= 2)
          suggestions.push({
            label: "Pitch top 3",
            prompt: `Draft outreach to ${top3Names} and show all three for approval.`,
          });
        else
          suggestions.push({
            label: "Find more brands",
            prompt: `Find 10 more brand matches that fit my niche and rate floor.`,
          });
        suggestions.push({
          label: "Why this fit?",
          prompt: `Walk me through the top match — audience overlap, past deals, price fit — in plain English.`,
        });
        break;
      case page === "/dashboard/approvals":
        message =
          pendingApprovals > 0
            ? `You've got ${pendingApprovals} brand ${pendingApprovals === 1 ? "reply" : "replies"} to review. Want me to open the first and draft your response?`
            : `Inbox is clear. Want me to line up new outreach so more replies land here?`;
        if (pendingApprovals > 0) {
          suggestions.push({
            label: "Open first",
            prompt: `Open my first pending approval and explain what they're asking in one sentence.`,
          });
          suggestions.push({
            label: "Draft all responses",
            prompt: `Draft a response to every unanswered reply in my voice so I can approve or edit each one.`,
          });
        } else {
          suggestions.push({
            label: "Send more outreach",
            prompt: `Find brand matches and draft outreach to my top 3 so I have replies coming in.`,
          });
        }
        break;
      case page === "/dashboard/deals": {
        const active = deals.data?.length ?? 0;
        message = active
          ? `You've got ${active} deal${active === 1 ? "" : "s"} in flight. Want a status pass?`
          : `No open deals yet. Want me to start outreach so we can get one moving?`;
        if (active)
          suggestions.push({
            label: "Status of every deal",
            prompt: `Give me the status of every open deal — flag anything stuck or needing me.`,
          });
        suggestions.push({
          label: "Chase overdue",
          prompt: `Chase any brand that's late on payment, approval, or reply.`,
        });
        break;
      }
      case page === "/dashboard/tracker":
        message = `Looking at your tracker. Want me to break down what's active, what's stuck, and what needs action today?`;
        suggestions.push({
          label: "This week",
          prompt: `Plain-English summary of this week's outreach, replies, and closes.`,
        });
        suggestions.push({
          label: "What's working?",
          prompt: `Which niches, subject lines, and price points are converting best?`,
        });
        suggestions.push({
          label: "Grow my income",
          prompt: `Recommend 3 concrete moves to grow my income next month based on my real data.`,
        });
        break;
      case page === "/dashboard/tools":
        message = `On Tools. Want me to check an offer, price a package, or draft a counteroffer?`;
        suggestions.push({
          label: "Check this offer",
          prompt: `Check a brand offer for usage rights, payment terms, and other red flags.`,
        });
        suggestions.push({
          label: "What should I charge?",
          prompt: `Help me price a real deal using my creator setup.`,
        });
        suggestions.push({
          label: "Draft a counter",
          prompt: `Draft a counteroffer for the last offer I pasted in.`,
        });
        break;
      case page === "/dashboard/campaigns":
        message = `Campaigns are the briefs I use to run outreach for you. Want me to help you set one up or edit an existing one?`;
        suggestions.push({
          label: "Create a campaign",
          prompt: `Walk me through creating a new campaign — ask me one question at a time.`,
        });
        break;
      case page === "/dashboard/settings":
        message = `Anything you want me to tune — voice, rate floor, inbox behavior, or connections?`;
        suggestions.push({
          label: "Inbox settings",
          prompt: `Walk me through the inbox and email settings I can adjust.`,
        });
        suggestions.push({
          label: "Set my rate floor",
          prompt: `Help me set a smart minimum deal value based on my niche and platform.`,
        });
        suggestions.push({
          label: "Tune my voice",
          prompt: `Help me tune the voice you use in outreach.`,
        });
        break;

      default:
        message = null;
    }

    return { message, suggestions };
  });
