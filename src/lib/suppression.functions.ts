/**
 * Per-creator do-not-contact list. Every outbound send checks this list
 * before hitting Resend, and unsubscribe clicks add to it automatically.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function norm(email: string) {
  return email.trim().toLowerCase();
}

export const listSuppressions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("suppression_list")
      .select("id, email, reason, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(500);
    return { entries: data ?? [] };
  });

export const addSuppression = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ email: z.string().email(), reason: z.string().max(80).optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("suppression_list")
      .upsert(
        { user_id: context.userId, email: norm(data.email), reason: data.reason ?? "manual" },
        { onConflict: "user_id,email" },
      );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const removeSuppression = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("suppression_list")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const getComplianceSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("physical_address, unsubscribe_footer_enabled")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      physical_address: data?.physical_address ?? null,
      unsubscribe_footer_enabled: data?.unsubscribe_footer_enabled !== false,
    };
  });

export const updateComplianceSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        physical_address: z.string().max(200).nullable().optional(),
        unsubscribe_footer_enabled: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: {
      physical_address?: string | null;
      unsubscribe_footer_enabled?: boolean;
    } = {};
    if (data.physical_address !== undefined) patch.physical_address = data.physical_address;
    if (data.unsubscribe_footer_enabled !== undefined)
      patch.unsubscribe_footer_enabled = data.unsubscribe_footer_enabled;
    if (Object.keys(patch).length === 0) return { ok: true as const };
    const { error } = await supabaseAdmin
      .from("profiles")
      .update(patch)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
