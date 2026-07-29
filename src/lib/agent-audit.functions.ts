/**
 * Agent audit log — every autonomous MatchAI action is recorded here so
 * creators can review or undo what the agent did on their behalf.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AuditEntry = {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  autonomy_level: number;
  metadata: Record<string, string | number | boolean | null>;
  undone_at: string | null;
  created_at: string;
};

export const listAgentAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ limit: z.number().int().min(1).max(200).optional() }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("agent_audit_log")
      .select("id, action, target_type, target_id, autonomy_level, metadata, undone_at, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    return { entries: (rows ?? []) as AuditEntry[] };
  });

export const undoAgentAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ audit_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: entry } = await supabaseAdmin
      .from("agent_audit_log")
      .select("id, action, target_type, target_id, undone_at, user_id")
      .eq("id", data.audit_id)
      .maybeSingle();
    if (!entry || entry.user_id !== context.userId) throw new Error("Not found");
    if (entry.undone_at) return { ok: true as const, alreadyUndone: true };

    // Reversible: cancel a queued outreach that hasn't been sent yet.
    if (entry.target_type === "outreach_email" && entry.target_id) {
      await supabaseAdmin
        .from("outreach_emails")
        .update({ cancelled: true })
        .eq("id", entry.target_id)
        .eq("user_id", context.userId)
        .eq("sent", false);
    }

    await supabaseAdmin
      .from("agent_audit_log")
      .update({ undone_at: new Date().toISOString() })
      .eq("id", data.audit_id);
    return { ok: true as const };
  });
