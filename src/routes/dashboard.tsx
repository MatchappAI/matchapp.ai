import { createFileRoute, Outlet, redirect, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { MessageCircle, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { DashboardChatPanel } from "@/components/chat/DashboardChatPanel";
import { AgentCursor } from "@/components/chat/AgentCursor";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { FullScreenLoader } from "@/components/dashboard/PageLoader";
import { MatchAILogo } from "@/components/brand/MatchAILogo";
import { DemoBanner } from "@/components/dashboard/DemoBanner";
import { SetupWelcomeModal } from "@/components/dashboard/SetupWelcomeModal";
import { DEMO_MODE } from "@/lib/demo-mode";

import { getCurrentUser } from "@/lib/dashboard.functions";
import { getMyRoles } from "@/lib/insights.functions";
import { usePageViewTracking } from "@/hooks/use-track";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — MatchAI" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_complete")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (profile && profile.onboarding_complete === false) {
      throw redirect({ to: "/onboarding" });
    }
  },
  pendingComponent: () => <FullScreenLoader label="Loading your workspace…" />,
  component: DashboardLayout,
});

function DashboardLayout() {
  const get = useServerFn(getCurrentUser);
  const { data } = useQuery({
    queryKey: ["dashboard-user"],
    queryFn: () => get({ data: {} as never }),
  });
  const getRoles = useServerFn(getMyRoles);
  const { data: rolesData } = useQuery({
    queryKey: ["my-roles"],
    queryFn: () => getRoles({ data: {} as never }),
  });
  usePageViewTracking();

  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const stageRef = useRef<HTMLElement>(null);

  const fullName =
    data?.profile?.display_name ?? data?.profile?.full_name ?? data?.profile?.email ?? null;

  return (
    <div data-app-scope="dashboard" className="flex h-screen w-full min-w-0 flex-col overflow-hidden bg-background text-foreground">
      {DEMO_MODE && <DemoBanner />}
      <SetupWelcomeModal />
      {/* Body: chat left 50% + live agent stage right 50% */}
      <div className="flex min-h-0 flex-1">
        <aside className="hidden min-h-0 w-1/2 shrink-0 flex-col border-r border-border/60 md:flex">
          <DashboardChatPanel />
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col md:w-1/2">

          {/* Right-side top bar: tabs + avatar (logo lives in the chat panel) */}
          <header className="grid shrink-0 gap-2 border-b border-border/60 bg-card/40 px-4 py-2 backdrop-blur-xl lg:px-8">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="min-w-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Workspace
              </div>
            <Link
              to="/dashboard/settings"
              className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              aria-label="Open settings"
            >
              {data?.profile?.avatar_url ? (
                <img
                  src={data.profile.avatar_url}
                  alt={fullName ?? "avatar"}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                (fullName ?? "U").slice(0, 1).toUpperCase()
              )}
            </Link>
            </div>
            <div className="min-w-0">
              <DashboardTabs isStaff={!!rolesData?.isStaff} />
            </div>
          </header>

          <section
            ref={stageRef}
            className="relative min-h-0 flex-1 overflow-y-auto px-4 py-6 lg:px-8"
          >
            <Outlet />
            {/* Visible cursor that MatchAI drives around the stage */}
            <AgentCursor containerRef={stageRef} />
          </section>
        </main>
      </div>


      {/* Mobile chat toggle */}
      <button
        type="button"
        onClick={() => setMobileChatOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 md:hidden"
        aria-label="Open MatchAI chat"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
      {mobileChatOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog">
          <div
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setMobileChatOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-[380px] border-l border-border/60 bg-background shadow-2xl">
            <button
              type="button"
              onClick={() => setMobileChatOpen(false)}
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-foreground/5 text-muted-foreground hover:text-foreground"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
            <DashboardChatPanel />
          </div>
        </div>
      )}
    </div>
  );
}
