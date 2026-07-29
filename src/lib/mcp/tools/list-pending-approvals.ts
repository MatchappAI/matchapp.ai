import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireUser, textResult, errorResult } from "../supabase";

export default defineTool({
  name: "list_pending_approvals",
  title: "List pending approvals",
  description: "List outbound outreach drafts awaiting the creator's approval.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).default(25),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    try {
      const userId = requireUser(ctx);
      const supabase = supabaseForUser(ctx);
      const { data, error } = await supabase
        .from("approvals")
        .select("id, kind, status, payload, created_at")
        .eq("user_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) return errorResult(error.message);
      return textResult(`Found ${data?.length ?? 0} pending approval(s).`, { approvals: data ?? [] });
    } catch (e) {
      return errorResult((e as Error).message);
    }
  },
});
