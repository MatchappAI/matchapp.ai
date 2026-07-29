import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getCreatorEmailTransport } from "@/lib/creator-email-transport.server";

const db = supabaseAdmin as unknown as SupabaseClient;

function identityAddress(userId: string): string {
  const domain = (process.env.CREATOR_EMAIL_FROM_DOMAIN ?? "mail.matchapp.ai").trim().toLowerCase();
  return `creator-${userId.replace(/-/g, "").slice(0, 12)}@${domain}`;
}

export const getCreatorEmailIdentity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const transport = getCreatorEmailTransport();
    const { data: existing } = await db
      .from("email_identities")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing) {
      return {
        identity: existing,
        transport: {
          provider: transport.provider,
          configured: transport.configured,
        },
      };
    }
    const { data: identity, error } = await db
      .from("email_identities")
      .insert({
        user_id: context.userId,
        address: identityAddress(context.userId),
        provider: transport.provider,
        status: transport.configured ? "active" : "provider_not_configured",
      })
      .select("*")
      .single();
    if (error || !identity) {
      throw new Error("Could not initialize your MatchAI email identity");
    }
    return {
      identity,
      transport: {
        provider: transport.provider,
        configured: transport.configured,
      },
    };
  });
