import { createFileRoute, redirect } from "@tanstack/react-router";
import { AuthPage } from "@/components/ui/auth-page";
import { supabase } from "@/integrations/supabase/client";
import { FullScreenLoader } from "@/components/dashboard/PageLoader";

type AuthSearch = {
  tab?: "signin" | "signup";
  plan?: "starter" | "growth" | "pro";
  next?: string;
};

// Only allow same-origin relative paths as `next` targets.
function safeNext(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return undefined;
  return value;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => {
    const tab = search.tab === "signup" || search.tab === "signin" ? search.tab : undefined;
    const plan =
      search.plan === "starter" || search.plan === "growth" || search.plan === "pro"
        ? search.plan
        : undefined;
    const next = safeNext(search.next);
    return { tab, plan, next };
  },
  head: () => ({
    meta: [
      { title: "Sign in — MatchAI" },
      { name: "description", content: "Sign in or create your MatchAI account." },
    ],
  }),
  // Don't flash the auth page to a user who's already signed in.
  // If they arrived with a plan selected, let the page mount so it can
  // route them through Stripe checkout instead of straight to the dashboard.
  beforeLoad: async ({ search }) => {
    const s = search as AuthSearch;
    if (s.plan) return;
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      if (s.next) {
        throw redirect({ href: s.next });
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_complete")
        .eq("user_id", data.user.id)
        .maybeSingle();
      throw redirect({
        to: profile?.onboarding_complete ? "/dashboard" : "/onboarding",
      });
    }
  },
  pendingComponent: () => <FullScreenLoader label="Checking your session…" />,
  component: AuthPage,
});
