import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Read the creator's persisted autonomy level and autopilot safety caps. */
export const getAutonomySettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("autonomy_level, autopilot_daily_send_cap, autopilot_daily_spend_cents")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      autonomy_level: (data?.autonomy_level ?? 2) as number,
      daily_send_cap: (data?.autopilot_daily_send_cap ?? 25) as number,
      daily_spend_cents: (data?.autopilot_daily_spend_cents ?? 50000) as number,
    };
  });

export const setAutonomySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        autonomy_level: z.number().int().min(0).max(3).optional(),
        daily_send_cap: z.number().int().min(0).max(500).optional(),
        daily_spend_cents: z.number().int().min(0).max(1_000_000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: {
      autonomy_level?: number;
      autopilot_daily_send_cap?: number;
      autopilot_daily_spend_cents?: number;
    } = {};
    if (data.autonomy_level !== undefined) patch.autonomy_level = data.autonomy_level;
    if (data.daily_send_cap !== undefined) patch.autopilot_daily_send_cap = data.daily_send_cap;
    if (data.daily_spend_cents !== undefined) patch.autopilot_daily_spend_cents = data.daily_spend_cents;
    if (Object.keys(patch).length === 0) return { ok: true as const };
    const { error } = await supabaseAdmin.from("profiles").update(patch).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
