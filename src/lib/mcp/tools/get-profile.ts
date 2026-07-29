import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, requireUser, textResult, errorResult } from "../supabase";

export default defineTool({
  name: "get_profile",
  title: "Get creator profile",
  description: "Get the signed-in creator's MatchAI profile: name, niche, audience, platforms, and onboarding status.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    try {
      const userId = requireUser(ctx);
      const supabase = supabaseForUser(ctx);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) return errorResult(error.message);
      if (!data) return textResult("No profile found for this user.", { profile: null });
      return textResult(`Profile for ${data.full_name ?? data.email ?? "user"}.`, { profile: data });
    } catch (e) {
      return errorResult((e as Error).message);
    }
  },
});
