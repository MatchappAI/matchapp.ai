/**
 * Direct, provider-abstracted AI access for the UGC rebuild - replaces the
 * Lovable AI Gateway (src/lib/ai-gateway.server.ts, which the old brand-deal
 * surface still uses and which this file does not touch).
 *
 * Per the build packet: a cheap model for extraction/classification, a
 * stronger model only where answer quality requires it (the follower-facing
 * chat agent), both behind one interface so swapping providers is a config
 * change, not a rewrite.
 *
 * Implementation note: uses @ai-sdk/openai-compatible (already proven
 * working in this repo for the Lovable gateway) pointed straight at OpenAI,
 * rather than the dedicated @ai-sdk/openai package - the dedicated package's
 * current major version targets a newer model-interface generation than
 * this repo's installed `ai` (6.0.x) supports, and OpenAI's API is directly
 * OpenAI-compatible by definition, so nothing is lost. Anthropic is NOT
 * wired up yet for the same reason (@ai-sdk/anthropic has the identical
 * version mismatch, and unlike OpenAI it has no compatible-endpoint
 * fallback) - revisit when this repo upgrades its `ai` dependency.
 */
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export type AiTask = "extraction" | "chat";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} - set it before calling the AI provider`);
  return value;
}

function openaiProvider() {
  return createOpenAICompatible({
    name: "openai",
    baseURL: "https://api.openai.com/v1",
    apiKey: requireEnv("OPENAI_API_KEY"),
  });
}

export function getModel(task: AiTask) {
  const provider = (process.env.UGC_AI_PROVIDER ?? "openai").toLowerCase();
  if (provider === "anthropic") {
    throw new Error(
      "Anthropic isn't wired up yet - see the comment at the top of ai-provider.server.ts. Use UGC_AI_PROVIDER=openai (the default) for now.",
    );
  }

  const openai = openaiProvider();
  return task === "chat" ? openai.chatModel("gpt-5") : openai.chatModel("gpt-5-mini");
}

/** text-embedding-3-small - matches the 1536-dim vector column in the migration. */
export function getEmbeddingModel() {
  return openaiProvider().embeddingModel("text-embedding-3-small");
}
