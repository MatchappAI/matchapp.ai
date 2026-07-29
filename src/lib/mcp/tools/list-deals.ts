import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireUser, textResult, errorResult } from "../supabase";

export default defineTool({
  name: "list_deals",
  title: "List deals",
  description: "List the signed-in creator's deals across the pipeline (prospect, negotiation, contracted, delivered, paid).",
  inputSchema: {
    limit: z.number().int().min(1).max(100).default(25),
    stage: z
      .enum(["prospect", "negotiating", "contracted", "in_progress", "delivered", "paid", "lost"])
      .optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, stage }, ctx) => {
    try {
      const userId = requireUser(ctx);
      const supabase = supabaseForUser(ctx);
      let q = supabase
        .from("deals")
        .select("id, brand_name, stage, amount_cents, currency, notes, created_at, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(limit);
      if (stage) q = q.eq("stage", stage);
      const { data, error } = await q;
      if (error) return errorResult(error.message);
      return textResult(`Found ${data?.length ?? 0} deal(s).`, { deals: data ?? [] });
    } catch (e) {
      return errorResult((e as Error).message);
    }
  },
});
