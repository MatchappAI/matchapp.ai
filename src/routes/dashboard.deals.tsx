import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
import { SlideOver } from "./dashboard.brands";
import { cn } from "@/lib/utils";
import { FastestToCashStrip } from "@/components/dashboard/FastestToCashStrip";
import { WaysToEarn } from "@/components/dashboard/WaysToEarn";
import { EarningsNudges } from "@/components/dashboard/EarningsNudges";
import { OvernightDigest } from "@/components/dashboard/OvernightDigest";
import { FirstDealJourney } from "@/components/dashboard/FirstDealJourney";

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
  const [openCard, setOpenCard] = useState<Card | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["deals-pipeline"],
    queryFn: () => list({ data: {} as never }),
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
      {/* One header for the whole money path — opportunities up top, pipeline below. */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Deals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track opportunities from first match through creator-reported external payment. MatchAI
          never holds or moves deal funds.
        </p>
      </div>

      <FirstDealJourney />
      <OvernightDigest />
      <EarningsNudges />
      <FastestToCashStrip />
      <WaysToEarn />

      <div className="pt-2">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Pipeline</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Drag cards between stages, or let me move them automatically as brands reply.
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
          description="Approve a draft in Approvals and I'll start a deal here. I'll move it across stages as I hear back."
          cta={{ label: "Review approvals", to: "/dashboard/approvals" }}
          secondaryCta={{ label: "Find brands", to: "/dashboard/brands" }}
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
            by you for organization only; MatchAI does not hold funds, provide escrow, charge a
            success fee, or process a payout.
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
