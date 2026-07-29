import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, Target, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SetupProgressStrip } from "@/components/dashboard/SetupProgressStrip";
import {
  analyzeCreatorDiscovery,
  listBrandDiscovery,
  listCreatorDiscovery,
  scoreDiscoveryMatch,
} from "@/lib/discovery-engine.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/discovery/creator")({
  head: () => ({ meta: [{ title: "Creator Discovery — MatchAI" }] }),
  component: CreatorDiscoveryPage,
});

function CreatorDiscoveryPage() {
  const qc = useQueryClient();
  const analyze = useServerFn(analyzeCreatorDiscovery);
  const listCreator = useServerFn(listCreatorDiscovery);
  const listBrands = useServerFn(listBrandDiscovery);
  const scoreMatch = useServerFn(scoreDiscoveryMatch);

  const creatorQuery = useQuery({
    queryKey: ["creator-discovery"],
    queryFn: () => listCreator({ data: {} as never }),
  });
  const brandsQuery = useQuery({
    queryKey: ["creator-discovery-brands"],
    queryFn: () => listBrands({ data: {} as never }),
  });

  const analyzeMut = useMutation({
    mutationFn: () => analyze({ data: {} as never }),
    onSuccess: () => {
      toast.success("Creator profile analyzed");
      qc.invalidateQueries({ queryKey: ["creator-discovery"] });
      qc.invalidateQueries({ queryKey: ["creator-discovery-brands"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not analyze"),
  });

  const scoreMut = useMutation({
    mutationFn: (brand_match_id: string) => scoreMatch({ data: { brand_match_id } }),
    onSuccess: () => {
      toast.success("Match scores updated in both directions");
      qc.invalidateQueries({ queryKey: ["creator-discovery"] });
      qc.invalidateQueries({ queryKey: ["creator-discovery-brands"] });
      qc.invalidateQueries({ queryKey: ["discovery-review"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not score"),
  });

  const creator = creatorQuery.data?.creator_profile as Record<string, unknown> | null | undefined;
  const content = creatorQuery.data?.creator_content_profile as
    | Record<string, unknown>
    | null
    | undefined;
  const creatorTargets = (creatorQuery.data?.creator_targets ?? []) as Array<
    Record<string, unknown>
  >;
  const brands = (brandsQuery.data?.brands ?? []) as Array<Record<string, unknown>>;
  const matchScores = (creatorQuery.data?.match_scores ?? []) as Array<Record<string, unknown>>;
  const scoreByBrand = new Map<string, Record<string, unknown>>();
  for (const score of matchScores) {
    const brandId = score.brand_match_id as string | null;
    if (brandId && !scoreByBrand.has(brandId)) scoreByBrand.set(brandId, score);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <SetupProgressStrip />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Creator Discovery
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Analyze the creator profile
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            This view scores each brand against the creator profile and also stores the reverse
            brand-to-creator score. No paid enrichment provider is required.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => analyzeMut.mutate()}
            disabled={analyzeMut.isPending}
            className="rounded-xl"
          >
            {analyzeMut.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Analyze creator
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-foreground/[0.06] bg-foreground/[0.03] p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Creator profile
              </p>
              <h2 className="text-xl font-semibold">
                {(creator?.full_name as string | null) ?? "Creator"}
              </h2>
            </div>
          </div>

          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <MetaRow label="Niche" value={(creator?.niche as string | null) ?? "—"} />
            <MetaRow
              label="Platforms"
              value={joinList((content?.platform_tags as string[] | null | undefined) ?? [])}
            />
            <MetaRow
              label="Audience tags"
              value={joinList((content?.audience_tags as string[] | null | undefined) ?? [])}
            />
            <MetaRow
              label="Tone tags"
              value={joinList((content?.tone_tags as string[] | null | undefined) ?? [])}
            />
            <MetaRow
              label="Followers"
              value={formatNumber(Number(content?.followers_total ?? 0))}
            />
            <MetaRow
              label="Engagement"
              value={
                content?.engagement_rate == null
                  ? "—"
                  : `${Number(content.engagement_rate).toFixed(2)}%`
              }
            />
            <MetaRow
              label="Analysis summary"
              value={(content?.analysis_summary as string | null) ?? "Analyze to populate"}
            />
          </div>
        </div>

        <div className="rounded-3xl border border-foreground/[0.06] bg-foreground/[0.03] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Imported creator targets
              </p>
              <h2 className="text-xl font-semibold">{creatorTargets.length} creators indexed</h2>
            </div>
            <div className="rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
              Internal recruiting fuel
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {creatorTargets.map((target) => {
              const evidence =
                (target.personalization_evidence as Record<string, unknown> | null) ?? {};
              const rateFloor = evidence.rate_floor ? Number(evidence.rate_floor) : null;
              const audienceTags = Array.isArray(evidence.audience_tags)
                ? (evidence.audience_tags as string[])
                : [];
              const toneTags = Array.isArray(evidence.tone_tags)
                ? (evidence.tone_tags as string[])
                : [];
              return (
                <div
                  key={target.id as string}
                  className="rounded-2xl border border-foreground/[0.06] bg-background/30 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="break-words font-semibold text-foreground">
                        {String(target.display_name ?? "Creator")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {String(target.company_name ?? target.email ?? "Imported creator")}
                      </p>
                    </div>
                    <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-300">
                      {String(target.outreach_direction ?? "brand_to_creator")}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <MetaRow
                      label="Platform"
                      value={String((evidence.platform as string | null) ?? "—")}
                    />
                    <MetaRow label="Audience" value={joinList(audienceTags)} />
                    <MetaRow label="Tone" value={joinList(toneTags)} />
                    <MetaRow
                      label="Rate floor"
                      value={rateFloor ? formatCurrency(rateFloor) : "—"}
                    />
                    <MetaRow
                      label="Email"
                      value={
                        String(target.email ?? "") ||
                        (Array.isArray(target.reply_to_addresses)
                          ? String(target.reply_to_addresses[0] ?? "")
                          : "") ||
                        "—"
                      }
                    />
                  </div>
                </div>
              );
            })}
            {creatorTargets.length === 0 && (
              <div className="rounded-2xl border border-dashed border-foreground/[0.08] p-6 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
                No imported creators yet. Use Admin Import to seed creator targets for recruiting
                and outreach.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-foreground/[0.06] bg-foreground/[0.03] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Brand to creator matches
              </p>
              <h2 className="text-xl font-semibold">{brands.length} brands scored</h2>
            </div>
            <div className="rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
              Two-way scores are stored together
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {brands.map((brand) => {
              const score = scoreByBrand.get(brand.id as string);
              const fit = Number(score?.fit_score ?? brand.fit_score ?? 0);
              const label = String(score?.label ?? brand.match_label ?? "Unscored");
              const pending = score?.direction ? score.direction === "brand_to_creator" : false;
              return (
                <div
                  key={brand.id as string}
                  className="rounded-2xl border border-foreground/[0.06] bg-background/30 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="break-words font-semibold text-foreground">
                          {brand.brand_name as string}
                        </p>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                            fit >= 90
                              ? "bg-emerald-500/15 text-emerald-300"
                              : fit >= 80
                                ? "bg-primary/15 text-primary"
                                : fit >= 70
                                  ? "bg-sky-500/15 text-sky-300"
                                  : "bg-foreground/[0.08] text-muted-foreground",
                          )}
                        >
                          {label}
                        </span>
                      </div>
                      <p className="mt-1 break-words text-xs text-muted-foreground">
                        {(brand.brand_industry as string | null) ?? "Brand"} ·{" "}
                        {(score?.next_action as string | null) ?? "Score to generate a next step"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-2xl font-semibold tabular-nums">{fit}</p>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          /100
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg"
                        onClick={() => scoreMut.mutate(brand.id as string)}
                        disabled={scoreMut.isPending && scoreMut.variables === brand.id}
                      >
                        {scoreMut.isPending && scoreMut.variables === brand.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Target className="mr-2 h-4 w-4" />
                        )}
                        {pending ? "Rescore" : "Score"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            {brands.length === 0 && (
              <div className="rounded-2xl border border-dashed border-foreground/[0.08] p-6 text-sm text-muted-foreground">
                No brands yet. Import a CSV or add one manually from the Brand Discovery page.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <span className="break-words text-sm text-foreground">{value}</span>
    </div>
  );
}

function joinList(values: string[]) {
  return values.length > 0 ? values.join(", ") : "—";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat(undefined).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value);
}
