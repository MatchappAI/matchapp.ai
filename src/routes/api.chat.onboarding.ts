import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { getUserIdFromRequest } from "@/lib/chat-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { startActorRun, getRunStatus, fetchDatasetItems, normalizeHandle } from "@/lib/apify.server";

export const Route = createFileRoute("/api/chat/onboarding")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await getUserIdFromRequest(request);
        if (!userId) return new Response("Unauthorized", { status: 401 });
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("AI not configured", { status: 500 });

        const { messages } = (await request.json()) as { messages: UIMessage[] };

        // Load existing profile data so the AI knows what's already collected
        const [profile, stats, rules, prefs] = await Promise.all([
          supabaseAdmin.from("creator_profiles").select("*").eq("user_id", userId).maybeSingle(),
          supabaseAdmin.from("platform_stats").select("*").eq("user_id", userId),
          supabaseAdmin.from("agent_rules").select("*").eq("user_id", userId).maybeSingle(),
          supabaseAdmin.from("brand_preferences").select("*").eq("user_id", userId).maybeSingle(),
        ]);

        const known = {
          profile: profile.data,
          stats_count: (stats.data ?? []).length,
          rules: rules.data,
          prefs: prefs.data,
        };

        const system = `You are MatchAI — onboarding a new creator. Friendly, warm, confident. ONE question per message. Keep messages 1–2 sentences.

ALREADY COLLECTED:
${JSON.stringify(known, null, 2)}

YOUR JOB: Collect the missing pieces across 3 phases via tools, then mark complete.

PHASE 1 — PROFILE: full_name, primary_platform, handle, niche, content_style, location, posting_frequency. After you have a handle + platform, call fetchPlatformStats — it pulls real follower count and engagement so you can reference them.
PHASE 2 — GOALS: monthly_income_goal, min_deal_value, preferred_deal_types (array), deals_per_month, blocked_categories, preferred_categories.
PHASE 3 — RULES: target_rate, walk_away_rate, auto_outreach (bool), approval_before_send (bool).

RULES:
- Save data with savePhase1 / savePhase2 / savePhase3 tools as soon as you have it. Don't ask twice.
- Call markPhaseComplete(phase) when you finish each phase, then transition naturally ("Great, I've got your profile. Now let's talk about what kind of deals you want...").
- Call finishOnboarding() ONLY after all three phases saved.
- Never mention databases, JSON, or fields. Talk like a person.
- If user goes off-topic, handle gracefully and redirect.`;

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const tools = {
          savePhase1: tool({
            description: "Save Phase 1 profile fields. Pass only fields you've collected.",
            inputSchema: z.object({
              full_name: z.string().optional(),
              primary_platform: z.string().optional(),
              handle: z.string().optional(),
              niche: z.string().optional(),
              content_style: z.string().optional(),
              location: z.string().optional(),
              posting_frequency: z.string().optional(),
            }),
            execute: async (data) => {
              const filtered = Object.fromEntries(
                Object.entries(data).filter(([, v]) => v != null && v !== ""),
              );
              if (!Object.keys(filtered).length) return { ok: false };
              await supabaseAdmin.from("creator_profiles").upsert(
                { user_id: userId, ...filtered, updated_at: new Date().toISOString() },
                { onConflict: "user_id" },
              );
              if (data.full_name || data.handle) {
                await supabaseAdmin
                  .from("profiles")
                  .update({
                    ...(data.full_name ? { full_name: data.full_name } : {}),
                    ...(data.handle ? { creator_handle: data.handle } : {}),
                  })
                  .eq("user_id", userId);
              }
              return { ok: true };
            },
          }),
          savePhase2: tool({
            description: "Save Phase 2 goals fields.",
            inputSchema: z.object({
              monthly_income_goal: z.number().optional(),
              min_deal_value: z.number().optional(),
              deal_type_preference: z.array(z.string()).optional(),
              deals_per_month: z.number().optional(),
              gifted_products_accepted: z.boolean().optional(),
              blocked_categories: z.string().optional(),
              preferred_categories: z.string().optional(),
            }),
            execute: async (data) => {
              const cpFields = (({ blocked_categories: _b, preferred_categories: _p, ...rest }) => rest)(data);
              if (Object.keys(cpFields).length) {
                await supabaseAdmin
                  .from("creator_profiles")
                  .upsert(
                    { user_id: userId, ...cpFields, updated_at: new Date().toISOString() },
                    { onConflict: "user_id" },
                  );
              }
              if (data.blocked_categories || data.preferred_categories) {
                await supabaseAdmin.from("brand_preferences").upsert(
                  {
                    user_id: userId,
                    blocked_categories: data.blocked_categories,
                    preferred_categories: data.preferred_categories,
                    configured: true,
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: "user_id" },
                );
              }
              return { ok: true };
            },
          }),
          savePhase3: tool({
            description: "Save Phase 3 rules fields.",
            inputSchema: z.object({
              target_rate: z.number().optional(),
              walk_away_rate: z.number().optional(),
              auto_outreach: z.boolean().optional(),
              approval_before_send: z.boolean().optional(),
              auto_follow_up: z.boolean().optional(),
            }),
            execute: async (data) => {
              await supabaseAdmin.from("agent_rules").upsert(
                {
                  user_id: userId,
                  ...data,
                  rules_configured: true,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "user_id" },
              );
              if (data.target_rate || data.walk_away_rate) {
                await supabaseAdmin.from("pricing_rules").upsert(
                  {
                    user_id: userId,
                    target_rate: data.target_rate,
                    walk_away_rate: data.walk_away_rate,
                    rate_floor: data.walk_away_rate,
                    configured: true,
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: "user_id" },
                );
              }
              return { ok: true };
            },
          }),
          fetchPlatformStats: tool({
            description: "Scrape real follower count, engagement rate, and recent post data for the creator's handle. Call once per platform after you have the handle.",
            inputSchema: z.object({
              platform: z.enum(["tiktok", "instagram", "youtube"]),
              handle: z.string(),
            }),
            execute: async ({ platform, handle }) => {
              const token = process.env.APIFY_TOKEN;
              if (!token) return { ok: false, error: "Scraper unavailable" };
              try {
                const run = await startActorRun(platform, handle, token);
                if (!run) return { ok: false, error: "Could not start scraper" };
                // Poll up to ~25s
                for (let i = 0; i < 12; i++) {
                  await new Promise((r) => setTimeout(r, 2000));
                  const st = await getRunStatus(run.runId, token);
                  if (st?.status === "complete" && st.datasetId) {
                    const items = await fetchDatasetItems(st.datasetId, token);
                    const first = items?.[0] as Record<string, any> | undefined;
                    if (!first) return { ok: false, error: "No data found" };
                    const followers =
                      (first.followersCount as number) ??
                      (first.followers as number) ??
                      (first.subscriberCount as number) ??
                      (first.authorMeta?.fans as number) ??
                      null;
                    const engagement =
                      (first.engagementRate as number) ??
                      (first.engagement as number) ??
                      null;
                    const avatarUrl: string | null =
                      first.profilePicUrlHD ??
                      first.profilePicUrl ??
                      first.authorMeta?.avatar ??
                      first.avatar ??
                      first.channelLogoUrl ??
                      first.thumbnail ??
                      null;
                    await supabaseAdmin.from("platform_stats").upsert(
                      {
                        user_id: userId,
                        platform,
                        handle: normalizeHandle(handle),
                        follower_count: followers,
                        engagement_rate: engagement,
                        fetched_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                      },
                      { onConflict: "user_id,platform" },
                    );
                    if (avatarUrl) {
                      await supabaseAdmin
                        .from("profiles")
                        .update({ avatar_url: avatarUrl })
                        .eq("user_id", userId);
                    }
                    return { ok: true, followers, engagement, handle, avatarUrl };
                  }
                  if (st?.status === "failed") {
                    return { ok: false, error: "Scraper failed" };
                  }
                }
                return { ok: false, error: "Scraper timeout — ask the creator manually" };
              } catch (e) {
                console.error("[onboarding.fetchPlatformStats]", e);
                return { ok: false, error: "Could not fetch stats" };
              }
            },
          }),
          markPhaseComplete: tool({
            description: "Mark a phase complete and update onboarding progress.",
            inputSchema: z.object({ phase: z.number().min(1).max(3) }),
            execute: async ({ phase }) => {
              await supabaseAdmin
                .from("profiles")
                .update({ onboarding_step: Math.min(phase + 1, 4) })
                .eq("user_id", userId);
              return { ok: true, phase };
            },
          }),
          finishOnboarding: tool({
            description: "Mark onboarding complete. Call only after all 3 phases saved.",
            inputSchema: z.object({}),
            execute: async () => {
              await supabaseAdmin
                .from("profiles")
                .update({ onboarding_complete: true, onboarding_step: 4 })
                .eq("user_id", userId);
              return { ok: true, complete: true };
            },
          }),
        };

        const result = streamText({
          model,
          system,
          messages: await convertToModelMessages(messages),
          tools,
          stopWhen: stepCountIs(40),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onFinish: async ({ messages: finalMessages }) => {
            try {
              const newOnes = finalMessages.slice(messages.length);
              const toSave = [messages[messages.length - 1], ...newOnes].filter(Boolean);
              for (const m of toSave) {
                const text = (m.parts ?? [])
                  .filter((p) => p.type === "text")
                  .map((p) => (p as { text: string }).text)
                  .join("");
                const toolPart = (m.parts ?? []).find(
                  (p) => typeof p.type === "string" && p.type.startsWith("tool-"),
                ) as { output?: unknown } | undefined;
                if (!text && !toolPart) continue;
                await supabaseAdmin.from("onboarding_messages").insert({
                  user_id: userId,
                  role: m.role === "user" ? "user" : "assistant",
                  content: text || "",
                  extracted_data: (toolPart?.output ?? null) as never,
                });
              }
            } catch (e) {
              console.error("[chat.onboarding persist]", e);
            }
          },
        });
      },
    },
  },
});
