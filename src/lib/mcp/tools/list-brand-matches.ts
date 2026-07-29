import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireUser, textResult, errorResult } from "../supabase";

export default defineTool({
  name: "list_brand_matches",
  title: "List brand matches",
  description: "List the signed-in creator's AI-generated brand matches with fit score, category, and status.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).default(25).describe("Max matches to return."),
    status: z
      .enum(["new", "queued", "outreach_drafted", "outreach_sent", "replied", "won", "lost", "archived"])
      .optional()
      .describe("Filter by match status."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, status }, ctx) => {
    try {
      const userId = requireUser(ctx);
      const supabase = supabaseForUser(ctx);
      let q = supabase
        .from("brand_matches")
        .select("id, brand_name, brand_domain, category, fit_score, status, reason, created_at")
        .eq("user_id", userId)
        .order("fit_score", { ascending: false })
        .limit(limit);
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) return errorResult(error.message);
      return textResult(
        `Found ${data?.length ?? 0} brand match(es).`,
        { matches: data ?? [] },
      );
    } catch (e) {
      return errorResult((e as Error).message);
    }
  },
});
