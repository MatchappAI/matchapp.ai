import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { ArrowRight, CalendarClock, Inbox, Reply, Search, Sparkles } from "lucide-react";
import { getAnalyticsOverview } from "@/lib/analytics.functions";
import { listDealsAndPipeline } from "@/lib/matchai.functions";
import { listInboxThreads } from "@/lib/inbox.functions";
import { askAgentInChat } from "@/lib/open-email-in-chat";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/tracker")({
  head: () => ({ meta: [{ title: "Tracker — MatchAI" }] }),
  component: TrackerPage,
});

function TrackerPage() {
  const getAnalytics = useServerFn(getAnalyticsOverview);
  const getDeals = useServerFn(listDealsAndPipeline);
  const getThreads = useServerFn(listInboxThreads);

  const analytics = useQuery({
    queryKey: ["tracker-analytics"],
    queryFn: () => getAnalytics({ data: {} as never }),
  });
  const deals = useQuery({
    queryKey: ["tracker-deals"],
    queryFn: () => getDeals({ data: {} as never }),
  });
  const threads = useQuery({
    queryKey: ["tracker-threads"],
    queryFn: () => getThreads({ data: {} as never }),
  });

  const rows = useMemo(() => {
    const threadRows = (threads.data?.threads ?? []).map((t) => {
      const deal = (deals.data?.deals ?? []).find(
        (d) => d.brand_match_id === t.brand_match_id || d.brand_name === t.brand_name,
      );
      const stage =
        deal?.invoice_status === "paid"
          ? "won"
          : t.stage === "rejected"
            ? "lost"
            : t.stage === "negotiating"
              ? "negotiating"
              : t.replied
                ? "replied"
                : t.opened
                  ? "opened"
                  : t.stage === "outreach_sent"
                    ? "follow-up due"
                    : t.stage_label.toLowerCase();
      const nextAction =
        deal?.invoice_status === "paid"
          ? "Closed — log the payment status if the brand paid you externally."
          : t.unread_reply
            ? "Open the reply and decide whether to counter."
            : t.opened
              ? "Follow up while the thread is warm."
              : t.stage === "outreach_sent"
                ? "Draft a follow-up and keep the thread warm."
                : t.stage === "negotiating"
                  ? "Check terms and push your counter."
                  : "Review the match and decide whether to pursue it.";
      const followUpDue =
        t.unread_reply || t.stage === "paid"
          ? "—"
          : t.stage === "outreach_sent"
            ? "Due now"
            : t.stage === "negotiating"
              ? "Within 24h"
              : "When ready";
      return {
        ...t,
        dealId: deal?.id ?? null,
        stage,
        nextAction,
        followUpDue,
      };
    });
    return threadRows;
  }, [deals.data?.deals, threads.data?.threads]);

  const isLoading = analytics.isLoading || deals.isLoading || threads.isLoading;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.2em] text-primary/70">Tracker</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Status, follow-ups, next moves
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            This is the control surface. Chat remains the communication layer; Tracker shows what
            needs attention across brand matches, replies, and active deals.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => askAgentInChat("Show me the threads that need a follow-up today.")}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Ask MatchAI
          </Button>
          <Button asChild>
            <Link to="/dashboard/inbox">
              <Inbox className="mr-2 h-4 w-4" />
              Open Messages
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Active deals"
          value={String(analytics.data?.pipeline.activeMatches ?? 0)}
          hint="Opportunities in motion"
        />
        <StatCard
          label="Replies"
          value={String(analytics.data?.outreach.replied ?? 0)}
          hint="Threads with responses"
        />
        <StatCard
          label="Paid externally"
          value={`$${Math.round(analytics.data?.money.earned ?? 0).toLocaleString()}`}
          hint="Creator-reported status"
          agentId="money"
        />
      </div>

      <div className="rounded-3xl border border-foreground/[0.06] bg-foreground/[0.03] p-4 sm:p-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <CalendarClock className="h-4 w-4 text-primary" />
          Follow-up queue
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Sorted by current urgency. Open a thread, draft a follow-up, or check an offer.
        </p>

        {isLoading ? (
          <div className="mt-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-foreground/[0.04]" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-foreground/[0.08] p-6 text-sm text-muted-foreground">
            No tracked threads yet. Start from Deals or Brand Matches.
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {rows.map((row) => (
              <div
                key={row.brand_match_id}
                data-agent-id={`tracker:${row.brand_match_id}`}
                className="rounded-2xl border border-foreground/[0.06] bg-background/60 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="break-words text-base font-semibold text-foreground">
                        {row.brand_name}
                      </p>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                          row.unread_reply
                            ? "bg-primary/15 text-primary"
                            : row.stage === "paid"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-foreground/[0.06] text-muted-foreground",
                        )}
                      >
                        {row.stage}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Last touch: {row.last_activity_kind.replace(/_/g, " ")} ·{" "}
                      {row.last_activity_preview}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Source: <span className="text-foreground">{row.source}</span>
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Next action: <span className="text-foreground">{row.nextAction}</span>
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Follow-up due: <span className="text-foreground">{row.followUpDue}</span>
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => askAgentInChat(`Draft a follow-up for ${row.brand_name}.`)}
                    >
                      Follow up
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        askAgentInChat(
                          `Draft a reply-all for ${row.brand_name} using the current thread context.`,
                        )
                      }
                    >
                      Reply all
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/dashboard/tools">
                        <Search className="mr-2 h-4 w-4" />
                        Check offer
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() =>
                        askAgentInChat(
                          `Draft a counteroffer for ${row.brand_name} based on the latest offer terms.`,
                        )
                      }
                    >
                      Counteroffer
                    </Button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="rounded-full border border-foreground/[0.08] px-2.5 py-1">
                    Thread: {row.event_count} events
                  </span>
                  <span className="rounded-full border border-foreground/[0.08] px-2.5 py-1">
                    Deal: {row.has_deal ? "linked" : "not linked yet"}
                  </span>
                  <span className="rounded-full border border-foreground/[0.08] px-2.5 py-1">
                    Deal detail: {row.dealId ? "available" : "not available yet"}
                  </span>
                    <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-xs">
                      <Link to="/dashboard/inbox">
                        <Reply className="mr-1.5 h-3.5 w-3.5" />
                        Open thread
                      </Link>
                    </Button>
                    {row.dealId && (
                      <>
                        <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-xs">
                          <Link to="/dashboard/deals/$id" params={{ id: row.dealId }}>
                            <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
                            Open context
                          </Link>
                        </Button>
                        <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-xs">
                          <Link to="/dashboard/deals/$id" params={{ id: row.dealId }}>
                            <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
                            Open deal
                          </Link>
                        </Button>
                      </>
                    )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  agentId,
}: {
  label: string;
  value: string;
  hint: string;
  agentId?: string;
}) {
  return (
    <div
      data-agent-id={agentId ? `tracker:${agentId}` : undefined}
      className="rounded-3xl border border-foreground/[0.06] bg-foreground/[0.03] p-5"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
