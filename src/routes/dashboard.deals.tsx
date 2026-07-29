import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, ArrowRight, SlidersHorizontal } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Button } from "@/components/ui/button";
import { listDealsAndPipeline, moveDealCard } from "@/lib/matchai.functions";
import {
  createInternalOutreachDraft,
  listCreatorDealOpportunities,
} from "@/lib/internal-outreach.functions";
import { SlideOver } from "./dashboard.brands";
import { cn } from "@/lib/utils";
import { DEMO_MODE, DEMO_OPPORTUNITIES } from "@/lib/demo-mode";

export const Route = createFileRoute("/dashboard/deals")({
  head: () => ({ meta: [{ title: "Deals — MatchAI" }] }),
  component: DealsPage,
});

type Stage =
  | "matched"
  | "outreach_sent"
  | "interested"
  | "negotiating"
  | "contract_sent"
  | "terms_agreed"
  | "deliverables_due"
  | "payment_pending"
  | "paid";

const STAGES: { id: Stage; label: string; tone: string }[] = [
  { id: "matched", label: "Matched", tone: "bg-foreground/[0.06] text-muted-foreground" },
  { id: "outreach_sent", label: "Marked sent", tone: "bg-sky-500/15 text-sky-300" },
  { id: "interested", label: "Reply logged", tone: "bg-violet-500/15 text-violet-300" },
  { id: "negotiating", label: "Negotiating", tone: "bg-amber-500/15 text-amber-300" },
  { id: "contract_sent", label: "Contract prepared", tone: "bg-blue-500/15 text-blue-300" },
  { id: "terms_agreed", label: "Terms agreed", tone: "bg-cyan-500/15 text-cyan-300" },
  { id: "deliverables_due", label: "Deliverables due", tone: "bg-orange-500/15 text-orange-300" },
  { id: "payment_pending", label: "Invoice prepared", tone: "bg-primary/15 text-primary" },
  { id: "paid", label: "Paid", tone: "bg-emerald-500/15 text-emerald-300" },
];

type Card = {
  kind: "match" | "deal";
  id: string;
  brand_name: string;
  value: number | null;
  rangeMin: number | null;
  rangeMax: number | null;
  stage: Stage;
};

type Opportunity = {
  id: string;
  brand_name: string;
  opportunity_title: string;
  why_now: string | null;
  signal_type: string | null;
  signal_summary: string | null;
  fit_score: number;
  cash_likelihood_score: number;
  fast_pay_score: number;
  estimated_pay_min: number | null;
  estimated_pay_max: number | null;
  pitch_angle: string | null;
  contact_readiness: number;
  risks: string[];
  brand_match_id: string | null;
  buying_intent_signal_id: string | null;
  status: string;
  source_record_type: string;
  category: string | null;
  effort: string | null;
  deadline: string | null;
  timing: string | null;
};

function matchStage(s: string): Stage {
  if (s === "new") return "matched";
  if (s === "pitched") return "outreach_sent";
  if (s === "replied") return "interested";
  if (s === "negotiating") return "negotiating";
  return "matched";
}

function dealStage(d: { status: string; contract_status: string; invoice_status: string }): Stage {
  if (d.invoice_status === "paid") return "paid";
  if (d.invoice_status === "invoiced") return "payment_pending";
  if (d.status === "in_progress") return "deliverables_due";
  if (d.contract_status === "accepted") return "terms_agreed";
  if (d.contract_status === "sent") return "contract_sent";
  return "negotiating";
}

function DealsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const list = useServerFn(listDealsAndPipeline);
  const move = useServerFn(moveDealCard);
  const listOpportunities = useServerFn(listCreatorDealOpportunities);
  const pursue = useServerFn(createInternalOutreachDraft);
  const [openCard, setOpenCard] = useState<Card | null>(null);
  const [openOpportunity, setOpenOpportunity] = useState<Opportunity | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [minFitScore, setMinFitScore] = useState("0");
  const [payFilter, setPayFilter] = useState("all");
  const [effortFilter, setEffortFilter] = useState("all");
  const [timingFilter, setTimingFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["deals-pipeline"],
    queryFn: () => list({ data: {} as never }),
  });

  const { data: opportunityData, isLoading: opportunitiesLoading } = useQuery({
    queryKey: ["creator-deals"],
    queryFn: () => listOpportunities({ data: {} as never }),
  });

  const cards: Card[] = useMemo(() => {
    const m = (data?.matches ?? []).map((b) => ({
      kind: "match" as const,
      id: b.id,
      brand_name: b.brand_name,
      value: null,
      rangeMin: b.estimated_deal_min ?? null,
      rangeMax: b.estimated_deal_max ?? null,
      stage: matchStage(b.status),
    }));
    const d = (data?.deals ?? []).map((deal) => ({
      kind: "deal" as const,
      id: deal.id,
      brand_name: deal.brand_name,
      value: deal.deal_value !== null ? Number(deal.deal_value) : null,
      rangeMin: null,
      rangeMax: null,
      stage: dealStage(deal),
    }));
    return [...d, ...m];
  }, [data]);

  const opportunities = useMemo<Opportunity[]>(() => {
    const opportunityRows =
      (opportunityData as { opportunities?: unknown[] } | undefined)?.opportunities ?? [];
    return (opportunityRows as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      brand_name: String(row.brand_name ?? "Brand"),
      opportunity_title: String(row.opportunity_title ?? row.signal_summary ?? "Opportunity"),
      why_now: (row.why_now as string | null) ?? null,
      signal_type: (row.signal_type as string | null) ?? null,
      signal_summary: (row.signal_summary as string | null) ?? null,
      fit_score: Number(row.fit_score ?? 0),
      cash_likelihood_score: Number(row.cash_likelihood_score ?? 0),
      fast_pay_score: Number(row.fast_pay_score ?? 0),
      estimated_pay_min: row.estimated_pay_min == null ? null : Number(row.estimated_pay_min),
      estimated_pay_max: row.estimated_pay_max == null ? null : Number(row.estimated_pay_max),
      pitch_angle: (row.pitch_angle as string | null) ?? null,
      contact_readiness: Number(row.contact_readiness ?? 0),
      risks: Array.isArray(row.risks) ? (row.risks as string[]) : [],
      brand_match_id: (row.brand_match_id as string | null) ?? null,
      buying_intent_signal_id: (row.buying_intent_signal_id as string | null) ?? null,
      status: String(row.status ?? "pending"),
      source_record_type: String(row.source_record_type ?? "manual"),
      category: (row.category as string | null) ?? (row.brand_industry as string | null) ?? null,
      effort: (row.effort as string | null) ?? null,
      deadline: (row.deadline as string | null) ?? null,
      timing: (row.timing as string | null) ?? null,
    }));
  }, [opportunityData]);

  const feedOpportunities = useMemo<Opportunity[]>(() => {
    if (opportunities.length > 0 || !DEMO_MODE) return opportunities;
    return DEMO_OPPORTUNITIES.map((demo) => {
      const amounts =
        demo.estPayout.match(/\d[\d,]*/g)?.map((value) => Number(value.replace(/,/g, ""))) ?? [];
      return {
        id: demo.id,
        brand_name: demo.brand,
        opportunity_title: demo.dealType,
        why_now: demo.reasoning[0] ?? demo.nextStep,
        signal_type: demo.earnType ?? null,
        signal_summary: demo.reasoning.slice(0, 2).join(" "),
        fit_score: demo.fitScore,
        cash_likelihood_score: demo.responseLikelihood,
        fast_pay_score: Math.max(0, 100 - demo.estCloseDays * 8),
        estimated_pay_min: amounts[0] ?? null,
        estimated_pay_max: amounts[1] ?? amounts[0] ?? null,
        pitch_angle: demo.nextStep,
        contact_readiness: demo.contactStatus === "Verified email" ? 90 : 65,
        risks: [],
        brand_match_id: null,
        buying_intent_signal_id: null,
        status: "demo",
        source_record_type: "demo",
        category: demo.category,
        effort: demo.effort ?? null,
        deadline: demo.deadlineIso ?? null,
        timing: demo.brandFreshness,
      };
    });
  }, [opportunities]);

  const categories = useMemo(
    () =>
      [...new Set(feedOpportunities.map((opp) => opp.category).filter(Boolean) as string[])].sort(),
    [feedOpportunities],
  );

  const filteredOpportunities = useMemo(() => {
    const minimum = Number(minFitScore);
    return feedOpportunities.filter((opp) => {
      if (opp.fit_score < minimum) return false;
      if (categoryFilter !== "all" && opp.category !== categoryFilter) return false;
      if (payFilter === "known" && opp.estimated_pay_min == null && opp.estimated_pay_max == null)
        return false;
      if (payFilter === "under500" && (opp.estimated_pay_min ?? opp.estimated_pay_max ?? 0) >= 500)
        return false;
      if (payFilter === "500plus" && (opp.estimated_pay_max ?? opp.estimated_pay_min ?? 0) < 500)
        return false;
      if (effortFilter !== "all" && opp.effort !== effortFilter) return false;
      if (timingFilter === "known" && !opp.deadline && !opp.timing) return false;
      if (timingFilter === "soon") {
        if (!opp.deadline) return false;
        const days = (new Date(opp.deadline).getTime() - Date.now()) / 86_400_000;
        if (days < 0 || days > 7) return false;
      }
      return true;
    });
  }, [categoryFilter, effortFilter, feedOpportunities, minFitScore, payFilter, timingFilter]);

  const moveMut = useMutation({
    mutationFn: (p: { kind: "match" | "deal"; id: string; to_stage: Stage }) => move({ data: p }),
    onSuccess: (_r, vars) => {
      const lbl = STAGES.find((s) => s.id === vars.to_stage)?.label;
      toast.success(`Moved to ${lbl}`);
      qc.invalidateQueries({ queryKey: ["deals-pipeline"] });
      qc.invalidateQueries({ queryKey: ["home-stats"] });
    },
    onError: (e) => {
      toast.error(String(e).replace("Error: ", ""));
      qc.invalidateQueries({ queryKey: ["deals-pipeline"] });
    },
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const pursueMut = useMutation({
    mutationFn: (input: {
      opportunity_id?: string;
      brand_match_id?: string;
      brand_name?: string;
    }) => pursue({ data: input }),
    onSuccess: () => {
      toast.success("Inbox draft created");
      qc.invalidateQueries({ queryKey: ["creator-deals"] });
      qc.invalidateQueries({ queryKey: ["email-threads"] });
      qc.invalidateQueries({ queryKey: ["internal-outreach"] });
      navigate({ to: "/dashboard/inbox" });
    },
    onError: (e) => toast.error(String(e).replace("Error: ", "")),
  });

  function onDragEnd(e: DragEndEvent) {
    const overId = e.over?.id as Stage | undefined;
    if (!overId) return;
    const activeId = String(e.active.id);
    const card = cards.find((c) => `${c.kind}:${c.id}` === activeId);
    if (!card || card.stage === overId) return;
    moveMut.mutate({ kind: card.kind, id: card.id, to_stage: overId });
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-primary/70">Creator opportunities</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Deals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One place to decide what to pursue next. MatchAI shows the fit, expected scope, and why an
          opportunity is worth your time; payment is handled directly with the brand.
        </p>
      </div>

      <div className="rounded-3xl border border-foreground/[0.06] bg-gradient-to-br from-card via-card to-primary/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Matched opportunities</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Scores are estimates based on your profile and the available opportunity evidence.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {filteredOpportunities.length} shown
          </span>
        </div>

        <div className="mt-4 grid gap-3 rounded-2xl border border-foreground/[0.06] bg-background/50 p-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-xs font-medium text-muted-foreground">
            Category
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
            >
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Minimum match score
            <select
              value={minFitScore}
              onChange={(event) => setMinFitScore(event.target.value)}
              className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
            >
              <option value="0">Any score</option>
              <option value="70">70+</option>
              <option value="80">80+</option>
              <option value="90">90+</option>
            </select>
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Pay estimate
            <select
              value={payFilter}
              onChange={(event) => setPayFilter(event.target.value)}
              className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
            >
              <option value="all">Any estimate</option>
              <option value="known">Estimate available</option>
              <option value="under500">Under $500</option>
              <option value="500plus">$500+</option>
            </select>
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Effort
            <select
              value={effortFilter}
              onChange={(event) => setEffortFilter(event.target.value)}
              className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
            >
              <option value="all">Any effort</option>
              {[
                ...new Set(feedOpportunities.map((opp) => opp.effort).filter(Boolean) as string[]),
              ].map((effort) => (
                <option key={effort} value={effort}>
                  {effort}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Timing
            <select
              value={timingFilter}
              onChange={(event) => setTimingFilter(event.target.value)}
              className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
            >
              <option value="all">Any timing</option>
              <option value="known">Timing available</option>
              <option value="soon">Due within 7 days</option>
            </select>
          </label>
        </div>

        {opportunities.length === 0 && DEMO_MODE && (
          <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            Sample opportunities are shown for preview only. Add real or imported brands to create
            live pitches.
          </p>
        )}

        {opportunitiesLoading ? (
          <div className="mt-4 flex h-40 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading opportunities…
          </div>
        ) : feedOpportunities.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-foreground/[0.1] p-5 text-sm text-muted-foreground">
            No opportunities yet. Finish your creator profile or add a brand from the internal
            discovery tools to seed this feed.
          </div>
        ) : filteredOpportunities.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-foreground/[0.1] p-5 text-sm text-muted-foreground">
            No opportunities match these filters. Try widening the score or pay range.
          </div>
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {filteredOpportunities.slice(0, 6).map((opp) => (
              <button
                key={opp.id}
                type="button"
                onClick={() => setOpenOpportunity(opp)}
                className="group rounded-2xl border border-foreground/[0.06] bg-background/70 p-4 text-left transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{opp.brand_name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{opp.opportunity_title}</p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                    {opp.fit_score}/100 fit
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {opp.category && (
                    <span className="rounded-full bg-foreground/[0.06] px-2 py-1">
                      {opp.category}
                    </span>
                  )}
                  <span className="rounded-full bg-foreground/[0.06] px-2 py-1">
                    {opp.source_record_type === "ai_analysis"
                      ? "Profile match"
                      : opp.source_record_type === "brand_match"
                        ? "Imported or manual"
                        : opp.source_record_type}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                  Why it fits:{" "}
                  {opp.why_now ?? opp.signal_summary ?? "Based on your creator profile"}
                </p>
                <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>
                    {opp.estimated_pay_min || opp.estimated_pay_max
                      ? `$${opp.estimated_pay_min ?? 0}–$${opp.estimated_pay_max ?? 0}`
                      : "Pay TBD"}
                  </span>
                  <span>{opp.effort ?? "Effort TBD"}</span>
                  <span>
                    {opp.deadline
                      ? `Due ${new Date(opp.deadline).toLocaleDateString()}`
                      : (opp.timing ?? "Timing TBD")}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs font-medium text-primary">
                  <span>Pursue</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="pt-2">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Application pipeline
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Use this pipeline after you decide to pursue an opportunity. Payment status is only what
          you report; MatchAI does not hold or move deal funds.
        </p>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading pipeline…
        </div>
      ) : cards.length === 0 ? (
        <EmptyState
          title="No active deals yet"
          description="Pursue a match from the feed above to create an internal draft, or finish your profile to improve recommendations."
          cta={{ label: "Open settings", to: "/dashboard/settings" }}
          secondaryCta={{ label: "Open inbox", to: "/dashboard/inbox" }}
        />
      ) : (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="grid grid-flow-col auto-cols-[280px] gap-3 overflow-x-auto pb-4">
            {STAGES.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                cards={cards.filter((c) => c.stage === stage.id)}
                onOpen={setOpenCard}
              />
            ))}
          </div>
        </DndContext>
      )}

      {openCard && (
        <SlideOver onClose={() => setOpenCard(null)}>
          <DealDetailPanel
            card={openCard}
            onDone={() => setOpenCard(null)}
            onOpenFull={
              openCard.kind === "deal"
                ? () => {
                    const id = openCard.id;
                    setOpenCard(null);
                    navigate({ to: "/dashboard/deals/$id", params: { id } });
                  }
                : undefined
            }
          />
        </SlideOver>
      )}

      {openOpportunity && (
        <SlideOver onClose={() => setOpenOpportunity(null)}>
          <div className="space-y-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Opportunity
                </p>
                {openOpportunity.source_record_type === "demo" && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                    Demo / sample
                  </span>
                )}
              </div>
              <h2 className="mt-1 text-2xl font-semibold">{openOpportunity.brand_name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {openOpportunity.opportunity_title}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Metric label="Fit score" value={String(openOpportunity.fit_score)} />
              <Metric
                label="Cash likelihood"
                value={String(openOpportunity.cash_likelihood_score)}
              />
              <Metric label="Fast-pay score" value={String(openOpportunity.fast_pay_score)} />
              <Metric label="Category" value={openOpportunity.category ?? "Not available"} />
              <Metric label="Effort" value={openOpportunity.effort ?? "Not available"} />
              <Metric
                label="Estimated pay"
                value={
                  openOpportunity.estimated_pay_min || openOpportunity.estimated_pay_max
                    ? `$${openOpportunity.estimated_pay_min ?? 0}–$${openOpportunity.estimated_pay_max ?? 0}`
                    : "TBD"
                }
              />
            </div>

            <div className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.03] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Why now
              </p>
              <p className="mt-1 text-sm text-foreground">
                {openOpportunity.why_now ??
                  openOpportunity.signal_summary ??
                  "The timing looks active."}
              </p>
            </div>

            <div className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.03] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Pitch angle
              </p>
              <p className="mt-1 text-sm text-foreground">
                {openOpportunity.pitch_angle ?? "Lead with a direct, practical pitch."}
              </p>
            </div>

            {openOpportunity.risks.length > 0 && (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-200">
                  Risks
                </p>
                <ul className="mt-2 space-y-1 text-sm text-amber-50/90">
                  {openOpportunity.risks.map((risk) => (
                    <li key={risk}>{risk}</li>
                  ))}
                </ul>
              </div>
            )}

            <Button
              className="w-full rounded-xl"
              onClick={() => {
                if (openOpportunity.source_record_type === "demo") {
                  toast.info(
                    "This is sample data. Add a real or imported brand to create a pitch.",
                  );
                  return;
                }
                pursueMut.mutate(
                  openOpportunity.source_record_type === "brand_opportunity"
                    ? { opportunity_id: openOpportunity.id }
                    : openOpportunity.brand_match_id
                      ? { brand_match_id: openOpportunity.brand_match_id }
                      : { brand_name: openOpportunity.brand_name },
                );
              }}
              disabled={pursueMut.isPending}
            >
              {pursueMut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Pursue
            </Button>
          </div>
        </SlideOver>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.03] p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function KanbanColumn({
  stage,
  cards,
  onOpen,
}: {
  stage: { id: Stage; label: string; tone: string };
  cards: Card[];
  onOpen: (c: Card) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: stage.id });
  const total = cards.reduce((sum, c) => {
    if (c.value !== null) return sum + c.value;
    if (c.rangeMax) return sum + c.rangeMax;
    if (c.rangeMin) return sum + c.rangeMin;
    return sum;
  }, 0);
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-full flex-col rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] p-3 transition-colors",
        isOver && "border-primary/40 bg-primary/[0.04]",
      )}
    >
      <div className="sticky top-0 z-10 -mx-3 -mt-3 mb-2 rounded-t-2xl bg-card/80 px-3 pt-3 pb-2 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              stage.tone,
            )}
          >
            {stage.label}
          </span>
          <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            {cards.length}
          </span>
        </div>
        {total > 0 && (
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            ${total.toLocaleString()} total
          </p>
        )}
      </div>
      <div className="flex-1 space-y-2 min-h-[200px]">
        {cards.map((c) => (
          <DraggableCard
            key={`${c.kind}:${c.id}`}
            card={c}
            stage={stage.id}
            onOpen={() => onOpen(c)}
          />
        ))}
        {cards.length === 0 && (
          <p className="px-1 py-6 text-center text-[11px] text-muted-foreground/60">
            Drop cards here
          </p>
        )}
      </div>
    </div>
  );
}

const DECISION_STAGES: Stage[] = ["interested", "negotiating", "payment_pending"];
const AGENT_TAKE: Partial<Record<Stage, string>> = {
  matched: "Ready to prepare outreach.",
  outreach_sent: "Marked sent — waiting on a reply you can log.",
  interested: "Reply logged — needs your call.",
  negotiating: "Quote or counter — your move.",
  contract_sent: "Contract prepared. Mark sent when you send it.",
  terms_agreed: "Terms agreed. Time to deliver.",
  deliverables_due: "Content owed soon.",
  payment_pending: "Payment is due outside MatchAI. Follow up when needed.",
  paid: "Marked paid by you. Payment was handled externally.",
};

function DraggableCard({ card, stage, onOpen }: { card: Card; stage: Stage; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${card.kind}:${card.id}`,
  });
  const needsCall = DECISION_STAGES.includes(stage);
  return (
    <div
      ref={setNodeRef}
      data-agent-id={`deals:${card.id}`}
      {...attributes}
      {...listeners}
      className={cn(
        "group cursor-grab rounded-xl border border-foreground/[0.06] bg-card/60 p-3 backdrop-blur transition-all active:cursor-grabbing",
        needsCall && "border-primary/30 bg-primary/[0.04]",
        isDragging && "opacity-50 scale-105",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="break-words text-sm font-semibold text-foreground">{card.brand_name}</p>
        {needsCall && (
          <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
            Your call
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {card.value !== null
          ? `$${card.value.toLocaleString()}`
          : card.rangeMin || card.rangeMax
            ? `$${card.rangeMin ?? 0}–$${card.rangeMax ?? 0}`
            : "Value TBD"}
      </p>
      <p className="mt-1.5 text-[11px] italic text-muted-foreground/80">
        My take: {AGENT_TAKE[stage] ?? "—"}
      </p>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="mt-2 text-xs font-medium text-primary hover:underline"
      >
        Open
      </button>
    </div>
  );
}

function DealDetailPanel({
  card,
  onDone: _onDone,
  onOpenFull,
}: {
  card: Card;
  onDone: () => void;
  onOpenFull?: () => void;
}) {
  const isDeal = card.kind === "deal";

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground capitalize">
          {STAGES.find((s) => s.id === card.stage)?.label}
        </p>
        <h2 className="mt-1 text-2xl font-semibold">{card.brand_name}</h2>
      </div>

      {onOpenFull && (
        <Button onClick={onOpenFull} variant="outline" className="w-full rounded-xl">
          Open full deal page
        </Button>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-foreground/[0.03] p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Type</p>
          <p className="mt-1 text-sm capitalize">{card.kind}</p>
        </div>
        <div className="rounded-2xl bg-foreground/[0.03] p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Value</p>
          <p className="mt-1 text-sm">
            {card.value !== null
              ? `$${card.value.toLocaleString()}`
              : card.rangeMin || card.rangeMax
                ? `$${card.rangeMin ?? 0}–$${card.rangeMax ?? 0}`
                : "TBD"}
          </p>
        </div>
      </div>

      {isDeal && (
        <div className="space-y-3 rounded-2xl border border-foreground/[0.06] bg-foreground/[0.03] p-4">
          <p className="text-sm font-semibold">External payment tracking</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            The brand pays you outside MatchAI. Any due or paid status in this pipeline is reported
            by you for organization only; MatchAI does not hold funds, provide escrow, or process a
            payment. Those statuses are creator-reported and handled externally.
          </p>
          <p className="rounded-xl bg-foreground/[0.04] p-3 text-xs text-muted-foreground">
            Move this card to “Payment due” or “Paid externally” when the real-world status changes.
          </p>
        </div>
      )}

      {!isDeal && (
        <p className="rounded-2xl bg-foreground/[0.03] p-4 text-xs text-muted-foreground">
          A deal record opens once you log a brand reply and accept terms.
        </p>
      )}
    </div>
  );
}
