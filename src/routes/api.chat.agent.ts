import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { getUserIdFromRequest } from "@/lib/chat-auth.server";
import { loadAgentContext, summarizeContext } from "@/lib/agent-context.server";
import {
  AGENT_VOICE_PRINCIPLES,
  AGENT_EXPERTISE,
  REDDIT_AUTHENTICITY_PRINCIPLES,
  NEGOTIATION_PROTECTION_RULES,
  REPLY_INTERPRETATION_RULES,
  personalizedVoiceGuide,
} from "@/lib/agent-voice.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/chat/agent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await getUserIdFromRequest(request);
        if (!userId) return new Response("Unauthorized", { status: 401 });

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("AI not configured", { status: 500 });

        const body = (await request.json()) as {
          messages: UIMessage[];
          currentPage?: string;
          autonomy?: number;
          autopilot?: boolean;
        };
        const { messages, currentPage } = body;
        // Legacy `autopilot` boolean maps to level 3.
        const autonomy = Math.max(
          0,
          Math.min(
            3,
            Number.isFinite(body.autonomy as number)
              ? (body.autonomy as number)
              : body.autopilot
                ? 3
                : 2,
          ),
        );

        const ctx = await loadAgentContext(userId);
        const ctxSummary = summarizeContext(ctx);
        const voiceGuide = personalizedVoiceGuide(ctx.profile);

        const autonomyBlock =
          autonomy === 3
            ? `\n# AUTONOMY: AUTOPILOT (creator opted in — level 3 of 3)
- Act autonomously. Take the next best step immediately without asking "should I?" for anything that isn't money, contract terms, or brand-specific judgment.
- Chain actions in one turn: find → draft → queue → follow up. Narrate briefly what you did.
- STILL require the creator to tap Send now / Confirm on approval cards for real external sends and external payment-status changes — autopilot never bypasses the button, just gets everything ready.
- CLARIFY ONLY when a critical fact is truly missing (rate floor, deliverables ambiguous, brand identity unclear, contradictory instructions). Ask ONE sharp question, then stop.
- If the ask is fully specified, skip clarifying questions entirely and just do it.`
            : autonomy === 2
              ? `\n# AUTONOMY: DRAFT (level 2 of 3 — default)
- Draft, queue, and prep everything the moment you have enough context. Never ask permission to draft.
- Pause for approval on anything that leaves the app (sends, replies, contracts) or moves money.
- If unsure between two reasonable paths, ask ONE sharp clarifying question — never stack questions.`
              : autonomy === 1
                ? `\n# AUTONOMY: SUGGEST (level 1 of 3)
- Recommend the next move clearly and offer to prep it. Don't create drafts, queue sends, or change settings until they say go.
- Give one recommendation + one short reason. Then wait.
- Ask ONE clarifying question only when a critical fact is missing.`
                : `\n# AUTONOMY: MANUAL (level 0 of 3)
- Answer questions and explain options. Do NOT draft, queue, send, or change anything without an explicit "do it" from the creator.
- If they ask a broad question, list the options briefly and wait for their pick.
- Never ask more than ONE clarifying question at a time.`;

        const system = `${AGENT_VOICE_PRINCIPLES}

${AGENT_EXPERTISE}

${REDDIT_AUTHENTICITY_PRINCIPLES}

${voiceGuide}
${autonomyBlock}

${ctxSummary}

CURRENT PAGE: ${currentPage ?? "(unknown)"} — anchor your suggestions to what the creator is looking at right now.

NORTH STAR — HELP THIS CREATOR GET THEIR NEXT PAID BRAND DEAL, FAST:
- You're their smart friend who happens to be a great brand manager. Talk like you're texting them. Never say "as an AI".
- Use the FULL context above (matches, replies, deals, rate floor, campaigns, past decisions). Reference specific brand names and dollar amounts. Never generic.
- Never re-ask for info that's already in context. Continue naturally from prior chats and completed actions ("that skincare pitch still in drafts", "the rate we set yesterday").
- Lead with a recommendation, not a question. Give the most useful answer first, then a short reason if it actually helps.
- Sequence the funnel silently: add or find a brand → draft → confirm → send through the configured creator-email transport → follow up → negotiate → deliver → track creator-reported external payment. Nudge whichever step unlocks progress next.
- If they have zero matches: offer manual brand entry or CSV import. No lead provider is configured. If matches but no outreach: propose the pitch for the top match by name. If replies are waiting: open the internal MatchAI email thread and draft the response. Deal payment happens outside MatchAI.
- Say what you're about to do, do it (via tool call), then say what happened in one line. Never claim something was sent/saved/researched unless a tool actually did it.
- If they say "ok" / "sure" / "go ahead", do the next step immediately — don't ask again.



${REPLY_INTERPRETATION_RULES}

${NEGOTIATION_PROTECTION_RULES}

CHAT FORMAT RULES:
- Follow the Personalized Agent Voice above for length, warmth, formality, explanation depth, and autonomy. There is no fixed reply length cap — use as many sentences as the moment actually needs, defaulting to the creator's "length" knob. Stay concise when a short answer is enough; go longer when they asked for real explanation, a full plan, or a walkthrough.
- Never use bullet points or numbered lists in chat. Talk like you're texting a knowledgeable friend.
- One topic at a time. Never list multiple questions.
- Reference real names and real numbers from the creator's data above. Never invent facts about the creator, their audience, the brand, or the deal.
- When the creator corrects you ("that's not me", "more casual", "stop recommending gifted", "be more direct", "don't mention follower count"), call proposeRememberPreference with a short, durable rule so it persists across future drafts and chats.
- For any action involving money, external communication, or irreversible change, ALWAYS call a "propose_*" tool that returns an approval card. Text replies like "yes" or "go ahead" do NOT trigger actions — only the card button does.
- When the creator asks you to draft, find, price, or check something — DO IT (call the right tool / draft inline). Do not narrate what you're "going to do" without doing it.
- Whenever the creator asks to look at, review, or work on something that has a dedicated view (brand matches, replies, deals, tracker, tools, campaigns, settings), immediately call navigateView first so the right pane switches to that view — then respond in one short sentence. Do this even if you also show an inline card.
- When discussing a specific brand or deal, also call showBrandCard / showDealCard so the cursor can move to that row on the right stage. Always pair the specific card with navigateView.

INTERNAL MATCHAI EMAIL MODEL (CRITICAL):
- Every creator communicates through their internal MatchAI email identity and Inbox. The delivery/synchronization API provider has not been selected. Never assume Gmail, Resend, SMTP, or any other transport.
- The MatchAI Inbox is the authoritative application model for creator outreach, threads, drafts, attachments, folders, and delivery state. Resend is only for MatchAI product emails.
- Real sending only happens after an explicit confirmation showing the exact action, From, To, CC, BCC, Reply-To when present, subject, final body, attachments, and associated brand/contact/deal. Text like "yes" is not a send confirmation.
- Read-only actions can run immediately. Sending, replying, forwarding, recipient changes, discarding drafts, archive/trash, accepting negotiation terms, and material deal changes require explicit creator confirmation.
- Execute every approved action exactly once using an idempotency key and audit record. Never fabricate a sent, synchronized, or delivery state.
- COLD OUTREACH vs REPLY — do NOT confuse them. This is the single most common accuracy mistake; get it right every turn:
  * COLD OUTREACH = the FIRST email TO a brand that has NOT written to the creator yet. There is no inbound message to respond to. Use showEmailDraft.
    - Allowed language: "pitch", "intro", "outreach", "reach out", "send it", "opener", "first email".
    - BANNED language on cold outreach (never use these words when the brand hasn't emailed the creator): "reply", "write back", "write them back", "respond to them", "response", "answer them", "get back to them", "Re:", "in-thread", "follow up on their message". If you catch yourself typing any of these on a cold outreach, rewrite the sentence.
    - Subject lines for cold outreach must NEVER start with "Re:" — that's a reply prefix.
  * REPLY = a response back to a brand that ALREADY emailed the creator (approval type reply_received, or the outreach row has brand_reply_text / replied=true). Use showReplyDraft, NEVER showEmailDraft or proposeSendOutreach.
    - Allowed language: "reply", "response", "write back", "answer them", "get back to them".
    - Never call a reply "cold outreach", "pitch", or "a new intro" — it is an in-thread response to their message.
  * If you're not 100% sure a brand replied, call showEmailThread first and check the "replied" / "brandReply" fields before choosing showEmailDraft vs showReplyDraft. Never guess.
  * VIEW EXISTING EMAIL = when the creator asks "what did I send", "what did they say", "show me the email/thread", "let me see the conversation with X" — call showEmailThread so the real thread renders right here in chat. Do NOT send them to Approvals just to read.
- Inbox and chat must use the same email/thread records and server actions. BCC recipients are visible only in the creator's private confirmation and draft views.
- Use this language:
  * "Drafted the pitch to {brand} — hit Send now right here when it looks right." (cold outreach)
  * "Queued — I'll watch for their first reply and surface it right here." (after Send now on a cold outreach)
  * "I drafted a follow-up. It'll send automatically 2 days out unless you pause it." (a nudge on an unanswered thread — still not a reply)
  * "Drafted your reply to {brand} — copy it or mark it sent from this card once you fire it off." (reply)
  * "Log {brand}'s reply here and I'll recommend the next response." (if a reply comes outside the system)
- When the creator says "send it," the Send now button on the inline draft card sends it — never claim it's sent unless the tool result confirms it.
- If the creator-email provider is not configured or fails, report the real state. Never claim a message was sent while delivery or synchronization is unavailable, pending, or failed.

HOW MATCHAI WORKS — AUTHORITATIVE FAQ (use these answers when asked; do not invent alternatives):
- Billing: Stripe is used only for a creator's MatchAI subscription. MatchAI does not custody creator-brand payments, and any payment status shown in the product is creator-reported and handled externally.
- Creator-brand payment: handled directly between the creator and brand outside MatchAI. Payment states in MatchAI are creator-reported tracking only.
- Outreach: sent from the creator's internal MatchAI address through the selected transport only after exact confirmation. Until a provider is selected, drafts work but sending does not.
- Brand sourcing: no external lead provider is configured. Support manual brand/contact entry and CSV import; do not imply live scraping or enrichment.
- Plan limits: Free = 20 matches + 10 sends/mo. Starter = 200 + 100. Pro = unlimited. Overage is soft-capped, never surprise-billed.
- Data & privacy: creator content and reply logs are used only to draft that creator's own outreach. Never resold. "Delete my data" is in Settings.
- If a product question isn't covered by this FAQ or the creator's real data, say: "I don't want to guess on that — let me flag it for the team." Then offer to draft a support message.
- ALWAYS end the turn with a substantive plain-language sentence. Never leave a turn as only a tool call — always follow up with one sentence tying the result back to what the creator asked.`;

        const gateway = createLovableAiGatewayProvider(key);
        // Use a broadly enabled streaming model for the in-app agent. The
        // previous 3.6 model can return gateway Forbidden errors in some
        // projects, which made every chat-driven button appear broken.
        const model = gateway("google/gemini-2.5-flash");

        const tools = {
          navigateView: tool({
            description:
              "Switch the dashboard right pane to a specific view so the creator can watch the work happen. Use liberally whenever the creator asks about brands, replies/approvals, deals, tracker, tools, campaigns, or settings. No approval needed.",
            inputSchema: z.object({
              view: z.enum([
                "brands",
                "approvals",
                "deals",
                "tracker",
                "tools",
                "campaigns",
                "settings",
              ]),
              highlightId: z.string().optional(),
            }),
            execute: async (input) => ({
              navigate: `/dashboard/${input.view}`,
              view: input.view,
              highlightId: input.highlightId ?? null,
            }),
          }),
          showBrandCard: tool({
            description:
              "Show a brand match card inline in chat. Use when discussing a specific brand.",
            inputSchema: z.object({ brandMatchId: z.string().uuid() }),
            execute: async ({ brandMatchId }) => {
              const { data } = await supabaseAdmin
                .from("brand_matches")
                .select("*")
                .eq("id", brandMatchId)
                .eq("user_id", userId)
                .maybeSingle();
              return data ?? { error: "Brand not found" };
            },
          }),
          showDealCard: tool({
            description: "Show a deal card inline. Use when discussing an active deal.",
            inputSchema: z.object({ dealId: z.string().uuid() }),
            execute: async ({ dealId }) => {
              const { data } = await supabaseAdmin
                .from("deals")
                .select("*")
                .eq("id", dealId)
                .eq("user_id", userId)
                .maybeSingle();
              return data ?? { error: "Deal not found" };
            },
          }),
          showEmailDraft: tool({
            description:
              "Show a COLD OUTREACH email draft inline (subject + body) — the first email TO a brand that hasn't written to the creator yet. Do NOT use this to respond to a brand's reply; use showReplyDraft for that. Do NOT send.",
            inputSchema: z.object({
              outreachId: z.string().uuid(),
              subject: z.string(),
              body: z.string(),
              toEmail: z.string().optional(),
              brandName: z.string(),
            }),
            execute: async (input) => {
              // Guard: refuse to render a "cold outreach" card if the brand
              // has already replied to this thread. Steer the agent to
              // showReplyDraft instead so it never mislabels a response.
              const { data: outreach } = await supabaseAdmin
                .from("outreach_emails")
                .select("id, replied, brand_reply_text")
                .eq("id", input.outreachId)
                .eq("user_id", userId)
                .maybeSingle();
              if (outreach?.replied || outreach?.brand_reply_text) {
                return {
                  error:
                    "This brand has already replied — do NOT use showEmailDraft. Call showReplyDraft instead and use reply language (never 'cold outreach', 'pitch', or 'Re:'-free openers).",
                  kind: "wrong_tool" as const,
                  correctTool: "showReplyDraft",
                  brandName: input.brandName,
                  outreachId: input.outreachId,
                };
              }
              // Also strip any accidental "Re:" prefix — cold outreach never uses one.
              const subject = input.subject.replace(/^\s*re:\s*/i, "").trim();
              const { data: approval } = await supabaseAdmin
                .from("approvals")
                .select("id")
                .eq("user_id", userId)
                .eq("related_id", input.outreachId)
                .maybeSingle();
              return {
                ...input,
                subject,
                approvalId: approval?.id ?? null,
                kind: "outreach_draft",
                isReply: false,
              };
            },
          }),
          showReplyDraft: tool({
            description:
              "Show a REPLY draft inline — a response back to a brand that already emailed the creator. Use this (never showEmailDraft) after a brand reply arrives in Approvals. The creator will send it from their own inbox as a reply in the existing thread. Do NOT send.",
            inputSchema: z.object({
              outreachId: z.string().uuid(),
              brandName: z.string(),
              body: z.string(),
              toEmail: z.string().optional(),
            }),
            execute: async (input) => {
              // Guard: refuse a reply draft if there's no inbound brand message yet.
              const { data: outreach } = await supabaseAdmin
                .from("outreach_emails")
                .select("id, replied, brand_reply_text")
                .eq("id", input.outreachId)
                .eq("user_id", userId)
                .maybeSingle();
              if (outreach && !outreach.replied && !outreach.brand_reply_text) {
                return {
                  error:
                    "No brand reply exists for this thread yet — do NOT use showReplyDraft. Call showEmailDraft (cold outreach) instead. Do not use words like 'reply', 'write back', or 'response'.",
                  kind: "wrong_tool" as const,
                  correctTool: "showEmailDraft",
                  brandName: input.brandName,
                  outreachId: input.outreachId,
                };
              }
              const { data: approval } = await supabaseAdmin
                .from("approvals")
                .select("id")
                .eq("user_id", userId)
                .eq("related_id", input.outreachId)
                .eq("approval_type", "reply_received")
                .maybeSingle();
              return {
                ...input,
                approvalId: approval?.id ?? null,
                kind: "reply_draft",
                isReply: true,
              };
            },
          }),
          suggestAttachments: tool({
            description:
              "Suggest specific portfolio files (screenshots, clips, media kits, decks, PDFs, docs) the creator should attach to the current outreach or reply draft. Use exact filenames from what the creator uploaded in Settings → Creator setup → Portfolio. Only call this after showEmailDraft or showReplyDraft so a compose window is open. When the creator confirms in chat, the files auto-attach in the compose window.",
            inputSchema: z.object({
              outreachId: z.string().uuid(),
              kind: z.enum(["outreach", "reply"]),
              brandName: z.string(),
              names: z
                .array(z.string())
                .min(1)
                .max(6)
                .describe("Filenames as they appear in the creator's portfolio."),
              reason: z
                .string()
                .max(300)
                .describe("Short, warm reason why these help this specific brand."),
            }),
            execute: async (input) => ({
              ...input,
              target: input.kind,
              cardKind: "attachment_suggestion" as const,
            }),
          }),

          showEmailThread: tool({
            description:
              "Show the actual sent email and any brand reply INLINE in chat so the creator can read the real back-and-forth without leaving chat. Use whenever the creator asks 'what did I send', 'what did they say', 'show me the email/reply/thread' or when reviewing a specific brand's conversation. Pass either an outreachId OR a brandMatchId; the tool will pull the most recent email + reply for that brand.",
            inputSchema: z.object({
              outreachId: z.string().uuid().optional(),
              brandMatchId: z.string().uuid().optional(),
              brandName: z.string(),
            }),
            execute: async (input) => {
              let query = supabaseAdmin
                .from("outreach_emails")
                .select("id, subject, body, sent_at, brand_reply_text, replied, brand_match_id")
                .eq("user_id", userId)
                .order("created_at", { ascending: false })
                .limit(1);
              if (input.outreachId) query = query.eq("id", input.outreachId);
              else if (input.brandMatchId) query = query.eq("brand_match_id", input.brandMatchId);
              else
                return { error: "Need outreachId or brandMatchId", kind: "email_thread" as const };
              const { data } = await query.maybeSingle();
              if (!data)
                return {
                  error: "No email found yet for this brand.",
                  kind: "email_thread" as const,
                  brandName: input.brandName,
                };
              return {
                kind: "email_thread" as const,
                brandName: input.brandName,
                outreachId: data.id,
                subject: data.subject,
                body: data.body,
                sentAt: data.sent_at,
                brandReply: data.brand_reply_text,
                replied: data.replied,
              };
            },
          }),

          proposeSendOutreach: tool({
            description:
              "DEPRECATED — do not use. MatchAI is fully internal; never propose sending email. Use showEmailDraft (cold outreach) or showReplyDraft (reply) and instruct the creator to open Approvals.",
            inputSchema: z.object({
              outreachId: z.string().uuid(),
              brandName: z.string(),
              subject: z.string(),
              toEmail: z.string(),
            }),
            execute: async (input) => ({
              requiresApproval: true,
              action: "send_outreach",
              params: { outreachId: input.outreachId },
              card: {
                title: `Send outreach to ${input.brandName}`,
                details: [
                  { label: "Subject", value: input.subject },
                  { label: "To", value: input.toEmail },
                ],
              },
            }),
          }),
          proposeApplyInsight: tool({
            description: "Propose applying a learning insight that will change agent behavior.",
            inputSchema: z.object({ insightId: z.string().uuid(), title: z.string() }),
            execute: async (input) => ({
              requiresApproval: true,
              action: "apply_insight",
              params: { insightId: input.insightId },
              card: { title: input.title, details: [] },
            }),
          }),
          proposeRememberPreference: tool({
            description:
              "Save a durable rule about how this creator wants the agent to work (voice, what to avoid, pricing posture, etc.) into Agent Memory. Use whenever the creator corrects you, says 'always do X', 'never do Y', 'stop recommending Z', 'I always want…'. Keep `text` short and actionable (e.g. 'Never recommend gifted-only deals.', 'Use a soft CTA, never anchor a price in message 1.').",
            inputSchema: z.object({
              text: z.string().min(4).max(240),
              reason: z.string().min(4).max(240),
            }),
            execute: async (input) => ({
              requiresApproval: true,
              action: "remember_preference",
              params: { text: input.text },
              card: {
                title: "Save to Agent Memory",
                details: [
                  { label: "Rule", value: input.text },
                  { label: "Why", value: input.reason },
                ],
              },
            }),
          }),

          /* ---------------- Read-only lookups (inline cards, no approval) ---------------- */

          showBrandList: tool({
            description:
              "Show the creator's top brand matches inline as a list of cards. Use when they ask 'show me brands', 'what matches do I have', 'find brands', 'top matches', etc. Also call navigateView('brands') alongside so the right pane switches.",
            inputSchema: z.object({
              limit: z.number().int().min(1).default(5),
              status: z.enum(["all", "pending", "contacted"]).default("all"),
            }),

            execute: async ({ limit, status }) => {
              let q = supabaseAdmin
                .from("brand_matches")
                .select(
                  "id, brand_name, brand_industry, fit_score, fit_quality_score, status, estimated_deal_min, estimated_deal_max, my_take",
                )
                .eq("user_id", userId)
                .order("fit_quality_score", { ascending: false, nullsFirst: false })
                .limit(limit);
              if (status !== "all") q = q.eq("status", status);
              const { data } = await q;
              return { kind: "brand_list", items: data ?? [] };
            },
          }),

          showReplyList: tool({
            description:
              "Show pending replies / approvals inline. Use when the creator asks 'what needs my reply', 'show my replies', 'anything waiting', etc.",
            inputSchema: z.object({ limit: z.number().int().min(1).default(5) }),
            execute: async ({ limit }) => {
              const { data } = await supabaseAdmin
                .from("approvals")
                .select("id, approval_type, brand_name, amount, status, created_at")
                .eq("user_id", userId)
                .eq("status", "pending")
                .order("created_at", { ascending: false })
                .limit(limit);
              return { kind: "reply_list", items: data ?? [] };
            },
          }),

          showEarnings: tool({
            description:
              "Return a live earnings stat card (earned this month, YTD, pending, potential). Use when the creator asks about money, ROI, 'how much have I made', 'what am I owed', etc. Answer with real numbers, no invention.",
            inputSchema: z.object({}),
            execute: async () => {
              const { data: deals } = await supabaseAdmin
                .from("deals")
                .select("deal_value, status, invoice_status, escrow_status, created_at")
                .eq("user_id", userId);
              const rows = deals ?? [];
              const now = new Date();
              const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
              const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();
              const paid = rows.filter((r) => r.invoice_status === "paid");
              const paidMonth = paid
                .filter((r) => (r.created_at ?? "") >= monthStart)
                .reduce((s, r) => s + Number(r.deal_value ?? 0), 0);
              const paidYear = paid
                .filter((r) => (r.created_at ?? "") >= yearStart)
                .reduce((s, r) => s + Number(r.deal_value ?? 0), 0);
              const pendingEscrow = rows
                .filter((r) => r.escrow_status === "funded" && r.invoice_status !== "paid")
                .reduce((s, r) => s + Number(r.deal_value ?? 0), 0);
              const inFlight = rows
                .filter(
                  (r) =>
                    r.status !== "completed" &&
                    r.status !== "cancelled" &&
                    r.invoice_status !== "paid",
                )
                .reduce((s, r) => s + Number(r.deal_value ?? 0), 0);
              return {
                kind: "earnings",
                monthEarned: Math.round(paidMonth),
                yearEarned: Math.round(paidYear),
                pendingRelease: Math.round(pendingEscrow),
                inFlight: Math.round(inFlight),
                paidDeals: paid.length,
                totalDeals: rows.length,
              };
            },
          }),

          /* ---------------- New approval-gated action tools ---------------- */

          proposeMarkDelivered: tool({
            description:
              "Propose marking a deal as delivered/completed (creator has fulfilled the deliverables). APPROVAL CARD.",
            inputSchema: z.object({
              dealId: z.string().uuid(),
              brandName: z.string(),
            }),
            execute: async (input) => ({
              requiresApproval: true,
              action: "mark_delivered",
              params: { dealId: input.dealId },
              card: {
                title: `Mark ${input.brandName} deal delivered`,
                details: [
                  { label: "Deal", value: input.brandName },
                  { label: "Effect", value: "Moves deal to 'completed' + notifies brand" },
                ],
              },
            }),
          }),

          proposeFileDispute: tool({
            description:
              "Propose flagging a deal as disputed (brand didn't pay, ghosted, changed terms, etc.). APPROVAL CARD.",
            inputSchema: z.object({
              dealId: z.string().uuid(),
              brandName: z.string(),
              reason: z.string().min(4).max(500),
            }),
            execute: async (input) => ({
              requiresApproval: true,
              action: "file_dispute",
              params: { dealId: input.dealId, reason: input.reason },
              card: {
                title: `Flag dispute on ${input.brandName}`,
                details: [
                  { label: "Reason", value: input.reason },
                  { label: "Effect", value: "External payment status is blocked pending review" },
                ],
              },
            }),
          }),

          proposePauseCampaign: tool({
            description:
              "Propose pausing an outreach campaign so no new sends go out until resumed. APPROVAL CARD.",
            inputSchema: z.object({
              campaignId: z.string().uuid(),
              campaignName: z.string(),
            }),
            execute: async (input) => ({
              requiresApproval: true,
              action: "pause_campaign",
              params: { campaignId: input.campaignId },
              card: {
                title: `Pause "${input.campaignName}"`,
                details: [{ label: "Effect", value: "No new outreach until you resume" }],
              },
            }),
          }),

          proposeResumeCampaign: tool({
            description: "Propose resuming a paused outreach campaign. APPROVAL CARD.",
            inputSchema: z.object({
              campaignId: z.string().uuid(),
              campaignName: z.string(),
            }),
            execute: async (input) => ({
              requiresApproval: true,
              action: "resume_campaign",
              params: { campaignId: input.campaignId },
              card: {
                title: `Resume "${input.campaignName}"`,
                details: [{ label: "Effect", value: "Outreach begins sending again" }],
              },
            }),
          }),

          proposeUpdateRate: tool({
            description:
              "Propose updating the creator's pricing floor / target / walkaway. APPROVAL CARD. Use when creator says 'my minimum is $X', 'raise my rate', etc.",
            inputSchema: z.object({
              floor: z.number().int().min(0).max(1000000).optional(),
              target: z.number().int().min(0).max(1000000).optional(),
              walkaway: z.number().int().min(0).max(1000000).optional(),
            }),
            execute: async (input) => ({
              requiresApproval: true,
              action: "update_rate",
              params: input,
              card: {
                title: "Update pricing rules",
                details: [
                  ...(input.floor !== undefined
                    ? [{ label: "Floor", value: `$${input.floor.toLocaleString()}` }]
                    : []),
                  ...(input.target !== undefined
                    ? [{ label: "Target", value: `$${input.target.toLocaleString()}` }]
                    : []),
                  ...(input.walkaway !== undefined
                    ? [{ label: "Walkaway", value: `$${input.walkaway.toLocaleString()}` }]
                    : []),
                ],
              },
            }),
          }),

          proposeUpdateBrief: tool({
            description:
              "Propose updating an outreach campaign's brief (objective, audience, talking points, budget, voice). APPROVAL CARD. Use when the creator gives new direction like 'change the budget to $2k' or 'the angle should be sustainability, not price'.",
            inputSchema: z.object({
              campaignId: z.string().uuid(),
              campaignName: z.string(),
              patch: z.object({
                objective: z.string().max(300).optional(),
                audience: z.string().max(300).optional(),
                talkingPoints: z.string().max(600).optional(),
                budget: z.string().max(120).optional(),
                voice: z.string().max(200).optional(),
              }),
            }),
            execute: async (input) => ({
              requiresApproval: true,
              action: "update_brief",
              params: { campaignId: input.campaignId, patch: input.patch },
              card: {
                title: `Update brief — "${input.campaignName}"`,
                details: Object.entries(input.patch)
                  .filter(([, v]) => typeof v === "string" && v.length > 0)
                  .map(([k, v]) => ({
                    label: k.charAt(0).toUpperCase() + k.slice(1),
                    value: String(v),
                  })),
              },
            }),
          }),

          proposeCreateCampaign: tool({
            description:
              "Propose creating a new outreach campaign with an initial brief. APPROVAL CARD. Use when the creator says 'start a new campaign for X'.",
            inputSchema: z.object({
              name: z.string().min(2).max(120),
              objective: z.string().min(4).max(300),
              audience: z.string().max(300).optional(),
              budget: z.string().max(120).optional(),
              voice: z.string().max(200).optional(),
            }),
            execute: async (input) => ({
              requiresApproval: true,
              action: "create_campaign",
              params: input,
              card: {
                title: `Create campaign — "${input.name}"`,
                details: [
                  { label: "Objective", value: input.objective },
                  ...(input.audience ? [{ label: "Audience", value: input.audience }] : []),
                  ...(input.budget ? [{ label: "Budget", value: input.budget }] : []),
                  ...(input.voice ? [{ label: "Voice", value: input.voice }] : []),
                ],
              },
            }),
          }),

          suggestNextPrompts: tool({
            description:
              "After answering, propose 2-3 short one-tap follow-up prompts the creator can use next (e.g. 'Draft outreach', 'Show only >90% fit', 'Find similar brands'). Call this at the very end of a turn only.",
            inputSchema: z.object({
              prompts: z.array(z.string().min(2).max(60)).min(2).max(3),
            }),
            execute: async (input) => ({ kind: "next_prompts", prompts: input.prompts }),
          }),
        };

        const result = streamText({
          model,
          system,
          messages: await convertToModelMessages(messages),
          tools,
          stopWhen: stepCountIs(500),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onFinish: async ({ messages: finalMessages }) => {
            try {
              // Save only the messages that are new (anything beyond the originally-sent set)
              const original = messages;
              const newOnes = finalMessages.slice(original.length);
              // Also save the last user message if not in DB yet (it's the last of `original`)
              const toSave = [original[original.length - 1], ...newOnes].filter(Boolean);
              for (const m of toSave) {
                const text = (m.parts ?? [])
                  .filter((p) => p.type === "text")
                  .map((p) => (p as { text: string }).text)
                  .join("");
                // Find tool result parts (inline cards / approvals)
                const toolPart = (m.parts ?? []).find(
                  (p) => typeof p.type === "string" && p.type.startsWith("tool-"),
                ) as { type: string; output?: unknown } | undefined;
                let cardType: string | null = null;
                let cardData: unknown = null;
                let requiresApproval = false;
                let action: string | null = null;
                if (toolPart && toolPart.output) {
                  cardType = toolPart.type.replace(/^tool-/, "");
                  cardData = toolPart.output;
                  const out = toolPart.output as {
                    requiresApproval?: boolean;
                    action?: string;
                    params?: unknown;
                  };
                  if (out.requiresApproval) {
                    requiresApproval = true;
                    action = out.action ?? null;
                    cardData = { ...out, ...(out.params ?? {}) };
                  }
                }
                if (!text && !cardData) continue;
                await supabaseAdmin.from("agent_messages").insert({
                  user_id: userId,
                  role: m.role === "user" ? "user" : "assistant",
                  content: text || "",
                  inline_card_type: cardType,
                  inline_card_data: cardData as never,
                  action_triggered: action,
                  requires_approval: requiresApproval,
                  approval_status: requiresApproval ? "pending" : "none",
                });
              }
            } catch (e) {
              console.error("[chat.agent persist]", e);
            }
          },
        });
      },
    },
  },
});
