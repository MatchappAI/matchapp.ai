import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, FolderKanban, ListChecks, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SetupProgressStrip } from "@/components/dashboard/SetupProgressStrip";
import {
  listBrandDiscovery,
  listCreatorDiscovery,
  listReviewQueue,
} from "@/lib/discovery-engine.functions";

export const Route = createFileRoute("/dashboard/discovery")({
  head: () => ({ meta: [{ title: "Discovery — MatchAI" }] }),
  component: DiscoveryHomePage,
});

function DiscoveryHomePage() {
  const listBrands = useServerFn(listBrandDiscovery);
  const listCreator = useServerFn(listCreatorDiscovery);
  const listQueue = useServerFn(listReviewQueue);

  const brandsQuery = useQuery({
    queryKey: ["discovery-brands"],
    queryFn: () => listBrands({ data: {} as never }),
  });
  const creatorQuery = useQuery({
    queryKey: ["discovery-creator"],
    queryFn: () => listCreator({ data: {} as never }),
  });
  const queueQuery = useQuery({
    queryKey: ["discovery-review"],
    queryFn: () => listQueue({ data: {} as never }),
  });

  const brandCount = brandsQuery.data?.brands?.length ?? 0;
  const creatorScores = creatorQuery.data?.match_scores?.length ?? 0;
  const pendingQueue = (queueQuery.data?.review_queue ?? []).filter(
    (row: Record<string, unknown>) => row.status === "pending",
  ).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <SetupProgressStrip />

      <div className="grid gap-3 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-3xl border border-foreground/[0.06] bg-gradient-to-br from-card via-card to-primary/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Unified Discovery Engine
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            One system for finding brands, evaluating creators, and approving drafts.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Brand discovery, creator analysis, scoring, and review all run through the same internal
            tables. Everything here is manual-first and CSV-first, with no paid enrichment provider
            required.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <StatCard icon={FolderKanban} label="Brands indexed" value={brandCount} tone="brand" />
          <StatCard icon={Users} label="Creator scores" value={creatorScores} tone="creator" />
          <StatCard icon={ListChecks} label="Pending reviews" value={pendingQueue} tone="review" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <LinkCard
          icon={Sparkles}
          title="Brand Discovery"
          body="Manual and CSV brand intake, brand profiles, and brand-to-creator scoring."
          to="/dashboard/brands"
          cta="Open brand discovery"
        />
        <LinkCard
          icon={Users}
          title="Creator Discovery"
          body="Analyze the creator profile, score brand fit in both directions, and shortlist the best candidates."
          to="/dashboard/discovery/creator"
          cta="Open creator discovery"
        />
        <LinkCard
          icon={ListChecks}
          title="Review Queue"
          body="Pending matches land here first. Approve a row to create an internal inbox draft."
          to="/dashboard/discovery/review"
          cta="Open review queue"
        />
      </div>

      <div className="rounded-3xl border border-foreground/[0.06] bg-foreground/[0.03] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">What is already wired</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The engine uses existing creator profiles, brand matches, brand contacts, inbox
              drafts, and deals before anything external is considered.
            </p>
          </div>
          <Button variant="outline" asChild className="rounded-xl">
            <Link to="/dashboard/brands">
              Go to brand discovery <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function LinkCard({
  icon: Icon,
  title,
  body,
  to,
  cta,
}: {
  icon: typeof Sparkles;
  title: string;
  body: string;
  to: string;
  cta: string;
}) {
  return (
    <div className="rounded-3xl border border-foreground/[0.06] bg-foreground/[0.03] p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{body}</p>
        </div>
      </div>
      <Button asChild className="mt-4 w-full rounded-xl">
        <Link to={to}>
          {cta}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof FolderKanban;
  label: string;
  value: number;
  tone: "brand" | "creator" | "review";
}) {
  const toneClass =
    tone === "brand"
      ? "bg-emerald-500/15 text-emerald-300"
      : tone === "creator"
        ? "bg-sky-500/15 text-sky-300"
        : "bg-amber-500/15 text-amber-300";
  return (
    <div className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.03] p-4">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
        </div>
      </div>
    </div>
  );
}
