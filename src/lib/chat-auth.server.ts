import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Validate Bearer token in a raw server route. Returns userId or null. */
export async function getUserIdFromRequest(request: Request): Promise<string | null> {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !token) return null;
  const sb = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
  const { data, error } = await sb.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub as string;
}
