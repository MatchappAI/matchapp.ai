import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { SetupProgressStrip } from "@/components/dashboard/SetupProgressStrip";
import { Button } from "@/components/ui/button";
import {
  approveReviewQueue,
  listReviewQueue,
  rejectReviewQueue,
} from "@/lib/discovery-engine.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/discovery/review")({
  head: () => ({ meta: [{ title: "Review Queue — MatchAI" }] }),
  component: ReviewQueuePage,
});

function ReviewQueuePage() {
  const qc = useQueryClient();
  const listQueue = useServerFn(listReviewQueue);
  const approveQueue = useServerFn(approveReviewQueue);
  const rejectQueue = useServerFn(rejectReviewQueue);

  const queueQuery = useQuery({
    queryKey: ["discovery-review"],
    queryFn: () => listQueue({ data: {} as never }),
  });

  const approveMut = useMutation({
    mutationFn: (queue_id: string) => approveQueue({ data: { queue_id } }),
    onSuccess: () => {
      toast.success("Inbox draft created");
      qc.invalidateQueries({ queryKey: ["discovery-review"] });
      qc.invalidateQueries({ queryKey: ["creator-discovery"] });
      qc.invalidateQueries({ queryKey: ["discovery-brands"] });
      qc.invalidateQueries({ queryKey: ["brand-matches"] });
      qc.invalidateQueries({ queryKey: ["email-threads"] });
      qc.invalidateQueries({ queryKey: ["email-thread"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not approve"),
  });

  const rejectMut = useMutation({
    mutationFn: (queue_id: string) => rejectQueue({ data: { queue_id } }),
    onSuccess: () => {
      toast.success("Removed from review queue");
      qc.invalidateQueries({ queryKey: ["discovery-review"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not reject"),
  });

  const queue = (queueQuery.data?.review_queue ?? []) as Array<Record<string, unknown>>;
  const scores = new Map<string, Record<string, unknown>>();
  for (const score of (queueQuery.data?.match_scores ?? []) as Array<Record<string, unknown>>) {
    const id = score.id as string | null;
    if (id) scores.set(id, score);
  }
  const briefs = new Map<string, Record<string, unknown>>();
  for (const brief of (queueQuery.data?.campaign_briefs ?? []) as Array<Record<string, unknown>>) {
    const id = brief.id as string | null;
    if (id) briefs.set(id, brief);
  }

  const pending = queue.filter((row) => row.status === "pending");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <SetupProgressStrip />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Review Queue
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Pending matches, briefs, and approvals
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Approving a match creates an internal inbox draft. Rejecting it keeps the queue clean
            without sending anything.
          </p>
        </div>
        <Button variant="outline" onClick={() => queueQuery.refetch()} className="rounded-xl">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {queueQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-foreground/[0.04]" />
          ))}
        </div>
      ) : pending.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-foreground/[0.08] bg-foreground/[0.03] p-8 text-sm text-muted-foreground">
          Nothing is waiting right now. Score a brand or analyze the creator to populate the queue.
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((item) => {
            const matchScore = item.match_score_id
              ? scores.get(item.match_score_id as string)
              : null;
            const brief = item.campaign_brief_id
              ? briefs.get(item.campaign_brief_id as string)
              : null;
            const fitScore = Number(matchScore?.fit_score ?? item.priority ?? 0);
            const label = String(matchScore?.label ?? "Pending");
            return (
              <div
                key={item.id as string}
                className="rounded-3xl border border-foreground/[0.06] bg-foreground/[0.03] p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="break-words text-lg font-semibold text-foreground">
                        {item.title as string}
                      </p>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider",
                          item.direction === "creator_to_brand"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-sky-500/15 text-sky-300",
                        )}
                      >
                        {item.direction as string}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.reason ? (item.reason as string) : "No reason captured."}
                    </p>
                    {brief && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Brief: {String(brief.summary ?? brief.title ?? "Ready for review")}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-semibold tabular-nums">{fitScore}</p>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {label}
                    </p>
                  </div>
                </div>

                {matchScore && (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <InfoList
                      title="Reasons"
                      items={(matchScore.reasons as string[] | null) ?? []}
                    />
                    <InfoList title="Risks" items={(matchScore.risks as string[] | null) ?? []} />
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    Next action:{" "}
                    {String(item.next_action ?? matchScore?.next_action ?? "Review the brief")}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      onClick={() => rejectMut.mutate(item.id as string)}
                      disabled={rejectMut.isPending && rejectMut.variables === item.id}
                    >
                      {rejectMut.isPending && rejectMut.variables === item.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="mr-2 h-4 w-4" />
                      )}
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      className="rounded-lg"
                      onClick={() => approveMut.mutate(item.id as string)}
                      disabled={approveMut.isPending && approveMut.variables === item.id}
                    >
                      {approveMut.isPending && approveMut.variables === item.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      )}
                      Approve and draft
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InfoList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-foreground/[0.06] bg-background/30 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </p>
      {items.length > 0 ? (
        <ul className="mt-2 space-y-1.5 text-sm text-foreground">
          {items.slice(0, 4).map((item) => (
            <li key={item} className="break-words">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Nothing recorded yet.</p>
      )}
    </div>
  );
}
