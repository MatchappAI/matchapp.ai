import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Sparkles,
  Loader2,
  X,
  Heart,
  ThumbsDown,
  Mail,
  Eye,
  EyeOff,
  Plus,
  Upload,
  Search,
  Building2,
  FileSpreadsheet,
} from "lucide-react";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Button } from "@/components/ui/button";
import {
  listBrandMatches,
  draftOutreachForBrand,
  setBrandMatchStatus,
  listApprovals,
} from "@/lib/matchai.functions";
import {
  createManualBrand,
  importBrandRows,
  previewBrandImport,
} from "@/lib/brand-library.functions";
import { cn } from "@/lib/utils";
import { useAgentHighlight } from "@/lib/agent-highlight";
import { PersonalizationSignals as PersonalizationSignalsInline } from "@/components/hero/PersonalizationSignals";
import { openEmailInChat } from "@/lib/open-email-in-chat";

import { SetupProgressStrip } from "@/components/dashboard/SetupProgressStrip";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/dashboard/brands")({
  head: () => ({ meta: [{ title: "Brand Matches — MatchAI" }] }),
  component: BrandsPage,
});

type ScoreBreakdown = {
  audience_fit: number;
  category_fit: number;
  sponsorship_likelihood: number;
  conversion_potential: number;
  deal_value_potential: number;
  brand_credibility_fit: number;
  outreach_timing: number;
  relationship_path: number;
  competitive_white_space: number;
  creator_leverage: number;
};

const SCORE_DIMENSIONS: { key: keyof ScoreBreakdown; label: string; weight: number }[] = [
  { key: "audience_fit", label: "Audience Fit", weight: 20 },
  { key: "category_fit", label: "Category Fit", weight: 15 },
  { key: "sponsorship_likelihood", label: "Sponsorship Likelihood", weight: 15 },
  { key: "conversion_potential", label: "Conversion Potential", weight: 15 },
  { key: "deal_value_potential", label: "Deal Value Potential", weight: 10 },
  { key: "brand_credibility_fit", label: "Brand Credibility Fit", weight: 10 },
  { key: "outreach_timing", label: "Outreach Timing", weight: 5 },
  { key: "relationship_path", label: "Relationship Path", weight: 5 },
  { key: "competitive_white_space", label: "Competitive White Space", weight: 3 },
  { key: "creator_leverage", label: "Creator Leverage", weight: 2 },
];

type Brand = {
  id: string;
  brand_name: string;
  brand_industry: string | null;
  fit_score: number | null;
  fit_quality_score: number | null;
  fit_reasoning: string | null;
  suggested_package: string | null;
  outreach_angle: string | null;
  estimated_deal_min: number | null;
  estimated_deal_max: number | null;
  status: string;
  market_type: "local" | "international" | null;
  my_take: string | null;
  partnership_angle: string | null;
  potential_risk: string | null;
  recommended_next_move: string | null;
  match_label: string | null;
  score_breakdown: ScoreBreakdown | null;
  why_creator_fits: string | null;
  why_brand_cares: string | null;
  top_reasons: string[] | null;
  suggested_deliverables: string[] | null;
  best_outreach_channel: string | null;
  contact_path: string | null;
  what_to_avoid: string | null;
  data_source: string | null;
};

type MarketFilter = "all" | "local" | "international";

function labelFor(score: number): string {
  if (score >= 90) return "Strong Match";
  if (score >= 80) return "Good Match";
  if (score >= 70) return "Worth Testing";
  if (score >= 60) return "Low Priority";
  return "Do Not Recommend";
}

function labelTone(label: string) {
  switch (label) {
    case "Strong Match":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "Good Match":
      return "border-primary/30 bg-primary/10 text-primary";
    case "Worth Testing":
      return "border-sky-500/30 bg-sky-500/10 text-sky-300";
    case "Low Priority":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    default:
      return "border-foreground/[0.08] bg-foreground/[0.04] text-muted-foreground";
  }
}

function formatDeal(min: number | null, max: number | null) {
  if (!min && !max) return null;
  const fmt = (n: number) => (n >= 1000 ? `$${Math.round(n / 100) / 10}k` : `$${n}`);
  if (min && max && min !== max) return `${fmt(min)}–${fmt(max)}`;
  return fmt(max ?? min ?? 0);
}

function BrandsPage() {
  const qc = useQueryClient();
  const highlightedId = useAgentHighlight("brands");

  const list = useServerFn(listBrandMatches);
  const draft = useServerFn(draftOutreachForBrand);
  const setStatus = useServerFn(setBrandMatchStatus);
  const listApprovalsFn = useServerFn(listApprovals);
  const [open, setOpen] = useState<Brand | null>(null);
  const [marketFilter, setMarketFilter] = useState<MarketFilter>("all");
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState("");
  const [libraryDialog, setLibraryDialog] = useState<"manual" | "csv" | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["brand-matches"],
    queryFn: () => list({ data: {} as never }),
  });

  const { data: approvalsData } = useQuery({
    queryKey: ["approvals"],
    queryFn: () => listApprovalsFn({ data: {} as never }),
  });
  const pendingDraftsRaw = (
    (approvalsData?.approvals ?? []) as Array<{
      id: string;
      approval_type: string;
      status: string;
      brand_name: string | null;
      related_id: string | null;
    }>
  ).filter((a) => a.approval_type === "outreach_draft" && a.status === "pending");
  // One row per brand — the most recent draft supersedes older ones so the
  // "Drafts waiting" list can't stack up 9 pitches for the same company.
  const pendingDrafts = (() => {
    const seen = new Set<string>();
    const out: typeof pendingDraftsRaw = [];
    for (const d of pendingDraftsRaw) {
      const k = (d.brand_name ?? d.related_id ?? d.id).toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(d);
    }
    return out;
  })();

  const draftMut = useMutation({
    mutationFn: (brand_match_id: string) => draft({ data: { brand_match_id } }),
    onSuccess: (r, brand_match_id) => {
      if (r.ok) {
        const brand = allBrands.find((b) => b.id === brand_match_id);
        toast.success("Opening pitch in chat");
        qc.invalidateQueries({ queryKey: ["brand-matches"] });
        qc.invalidateQueries({ queryKey: ["approvals"] });
        qc.invalidateQueries({ queryKey: ["agent-messages"] });
        setOpen(null);
        // Route the user straight into the chat email view.
        openEmailInChat({
          kind: "outreach",
          outreachId: r.outreach_id,
          brandName: brand?.brand_name ?? null,
        });
      } else toast.error(r.error);
    },
    onError: (e) => toast.error(String(e)),
  });

  const statusMut = useMutation({
    mutationFn: (v: { id: string; status: "saved" | "rejected" }) => setStatus({ data: v }),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ["brand-matches"] });
      toast.success(v.status === "saved" ? "Saved" : "Got it — won't show again");
    },
    onError: (e) => toast.error(String(e)),
  });

  const allBrands: Brand[] = ((data?.brands ?? []) as unknown[]).map((b) => {
    const r = b as Record<string, unknown>;
    const mt = r.market_type;
    return {
      ...(r as object),
      market_type: mt === "local" || mt === "international" ? mt : null,
    } as Brand;
  });

  const visibleBrands = useMemo(() => {
    return allBrands.filter((b) => {
      if (b.status === "rejected") return false;
      if (marketFilter !== "all" && b.market_type !== marketFilter) return false;
      if (
        search &&
        !`${b.brand_name} ${b.brand_industry ?? ""}`.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      const score = b.fit_score ?? b.fit_quality_score ?? 0;
      const label = b.match_label ?? labelFor(score);
      if (!showAll && (label === "Low Priority" || label === "Do Not Recommend")) return false;
      return true;
    });
  }, [allBrands, marketFilter, search, showAll]);

  const counts = {
    all: allBrands.filter((b) => b.status !== "rejected").length,
    local: allBrands.filter((b) => b.status !== "rejected" && b.market_type === "local").length,
    international: allBrands.filter(
      (b) => b.status !== "rejected" && b.market_type === "international",
    ).length,
  };

  const hiddenCount = useMemo(() => {
    return allBrands.filter((b) => {
      if (b.status === "rejected") return false;
      if (marketFilter !== "all" && b.market_type !== marketFilter) return false;
      const score = b.fit_score ?? b.fit_quality_score ?? 0;
      const label = b.match_label ?? labelFor(score);
      return label === "Low Priority" || label === "Do Not Recommend";
    }).length;
  }, [allBrands, marketFilter]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Earning surfaces (Ways to Earn, Fastest-to-Cash, Digest, Nudges,
          First Deal Journey) live on /dashboard/deals as the single money
          path. This page stays focused on the raw brand-match list for
          creators who want to browse and score. */}
      <SetupProgressStrip />

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 max-[680px]:grid-cols-1">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Brand Discovery
          </p>
          <h1 className="break-words text-3xl font-semibold tracking-tight">Brands</h1>
          <p className="mt-1 break-words text-sm text-muted-foreground">
            Add brands and contacts yourself or import a CSV. Discovery stays manual-first and no
            paid provider is required.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild className="rounded-xl">
            <Link to="/dashboard/discovery">Discovery hub</Link>
          </Button>
          <Button variant="outline" asChild className="rounded-xl">
            <Link to="/dashboard/discovery/creator">Creator view</Link>
          </Button>
          <Button variant="outline" onClick={() => setLibraryDialog("csv")} className="rounded-xl">
            <Upload className="mr-2 h-4 w-4" /> Import CSV
          </Button>
          <Button onClick={() => setLibraryDialog("manual")} className="rounded-xl">
            <Plus className="mr-2 h-4 w-4" /> Add brand
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search brands or industries"
          aria-label="Search brands"
          className="rounded-xl pl-9"
        />
      </div>

      <details className="group rounded-2xl border border-border/60 bg-card/40 backdrop-blur transition-colors hover:border-primary/30">
        <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-4 py-3 text-sm">
          <span className="flex min-w-0 flex-wrap items-center gap-2 text-foreground">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-[hsl(217_100%_72%)]" />
            <span className="break-words font-medium">What goes into each match & email</span>
            <span className="break-words text-[11px] text-muted-foreground">
              Full transparency — 38 signals
            </span>
          </span>
          <span className="text-[11px] text-muted-foreground transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="border-t border-border/50 px-2 pb-3 pt-1">
          <PersonalizationSignalsInline />
        </div>
      </details>

      {pendingDrafts.length > 0 && (
        <section className="rounded-3xl border border-primary/25 bg-primary/[0.05] p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="break-words text-sm font-semibold text-foreground">
                Drafts waiting for you
              </h2>
              <p className="mt-0.5 break-words text-xs text-muted-foreground">
                {pendingDrafts.length === 1
                  ? "One pitch is ready to review and send."
                  : `${pendingDrafts.length} pitches ready to review and send.`}
              </p>
            </div>
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
              {pendingDrafts.length}
            </span>
          </div>
          <ul className="space-y-2">
            {pendingDrafts.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-foreground/[0.06] bg-background/40 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <p className="break-words text-sm font-medium text-foreground">
                      {d.brand_name ?? "Brand"}
                    </p>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Draft ready — nothing sends until you approve.
                  </p>
                </div>
                <Button
                  size="sm"
                  className="rounded-lg"
                  onClick={() =>
                    openEmailInChat({
                      kind: "outreach",
                      approvalId: d.id,
                      outreachId: d.related_id,
                      brandName: d.brand_name,
                    })
                  }
                >
                  Review in chat
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {allBrands.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "local", "international"] as const).map((k) => {
            const on = marketFilter === k;
            const label = k === "all" ? "All" : k === "local" ? "Local" : "International";
            return (
              <button
                key={k}
                type="button"
                onClick={() => setMarketFilter(k)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                  on
                    ? "border-primary/40 bg-primary/15 text-foreground"
                    : "border-foreground/[0.08] bg-foreground/[0.03] text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
                <span className="ml-1.5 opacity-60">{counts[k]}</span>
              </button>
            );
          })}
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className={cn(
                "inline-flex min-w-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                showAll
                  ? "border-primary/40 bg-primary/15 text-foreground"
                  : "border-foreground/[0.08] bg-foreground/[0.03] text-muted-foreground hover:text-foreground",
              )}
            >
              {showAll ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showAll ? "Hide low priority" : `Show all (+${hiddenCount})`}
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-56 rounded-3xl" />
          ))}
        </div>
      ) : visibleBrands.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-10 w-10" />}
          title={search ? "No brands match that search" : "No brands yet"}
          description={
            search
              ? "Try a different name or industry."
              : "Add a brand and contact manually, or import your existing list from CSV."
          }
          cta={{
            label: search ? "Clear search" : "Add brand",
            onClick: () => (search ? setSearch("") : setLibraryDialog("manual")),
          }}
          secondaryCta={
            search ? undefined : { label: "Import CSV", onClick: () => setLibraryDialog("csv") }
          }
        />
      ) : (
        <motion.div
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.04 } } }}
        >
          {visibleBrands.map((b, i) => (
            <BrandCard
              key={b.id}
              brand={b}
              index={i}
              highlighted={highlightedId === b.id}
              onOpen={() => setOpen(b)}
              onPitch={() => draftMut.mutate(b.id)}
              onSave={() => statusMut.mutate({ id: b.id, status: "saved" })}
              onReject={() => statusMut.mutate({ id: b.id, status: "rejected" })}
              isPitching={draftMut.isPending && draftMut.variables === b.id}
            />
          ))}
        </motion.div>
      )}

      <AnimatePresence>
        {open && (
          <SlideOver key="slideover" onClose={() => setOpen(null)}>
            <BrandDetail
              brand={open}
              onPitch={() => draftMut.mutate(open.id)}
              isPitching={draftMut.isPending}
            />
          </SlideOver>
        )}
      </AnimatePresence>

      {libraryDialog && (
        <BrandLibraryDialog
          mode={libraryDialog}
          onModeChange={setLibraryDialog}
          onClose={() => setLibraryDialog(null)}
          onDone={() => {
            setLibraryDialog(null);
            qc.invalidateQueries({ queryKey: ["brand-matches"] });
          }}
        />
      )}

      {/* Draft review lives entirely inside the chat panel now. */}
    </div>
  );
}

type CsvRow = {
  rowNumber: number;
  brandName: string;
  industry: string;
  website?: string;
  contactName: string;
  contactTitle: string;
  contactEmail?: string;
  notes: string;
  source: "csv_import";
  sourceLabel?: "manual" | "csv";
  confidence?: "low" | "medium" | "high";
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function csvRows(text: string): CsvRow[] {
  const parsed = parseCsv(text);
  if (parsed.length < 2) return [];
  const aliases: Record<string, keyof Omit<CsvRow, "rowNumber" | "source">> = {
    brand: "brandName",
    brand_name: "brandName",
    name: "brandName",
    industry: "industry",
    category: "industry",
    website: "website",
    url: "website",
    contact: "contactName",
    contact_name: "contactName",
    contact_title: "contactTitle",
    title: "contactTitle",
    email: "contactEmail",
    contact_email: "contactEmail",
    notes: "notes",
  };
  const headers = parsed[0].map(
    (header) => aliases[header.trim().toLowerCase().replace(/\s+/g, "_")],
  );
  return parsed.slice(1).map((values, index) => {
    const row: CsvRow = {
      rowNumber: index + 2,
      brandName: "",
      industry: "",
      website: "",
      contactName: "",
      contactTitle: "",
      contactEmail: "",
      notes: "",
      source: "csv_import",
    };
    headers.forEach((header, column) => {
      if (header) row[header] = values[column] ?? "";
    });
    return row;
  });
}

function BrandLibraryDialog({
  mode,
  onModeChange,
  onClose,
  onDone,
}: {
  mode: "manual" | "csv";
  onModeChange: (mode: "manual" | "csv") => void;
  onClose: () => void;
  onDone: () => void;
}) {
  const createBrand = useServerFn(createManualBrand);
  const previewImport = useServerFn(previewBrandImport);
  const importRows = useServerFn(importBrandRows);
  const [form, setForm] = useState({
    brandName: "",
    industry: "",
    website: "",
    contactName: "",
    contactTitle: "",
    contactEmail: "",
    notes: "",
  });
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewImport>> | null>(null);

  const createMutation = useMutation({
    mutationFn: () => createBrand({ data: { ...form, source: "manual" } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Brand saved");
      onDone();
    },
    onError: (error) => toast.error(String(error).replace("Error: ", "")),
  });
  const previewMutation = useMutation({
    mutationFn: (inputRows: CsvRow[]) => previewImport({ data: { rows: inputRows } }),
    onSuccess: setPreview,
    onError: (error) => toast.error(String(error).replace("Error: ", "")),
  });
  const importMutation = useMutation({
    mutationFn: () => importRows({ data: { rows } }),
    onSuccess: (result) => {
      if (result.failures.length > 0) {
        toast.error(`Imported ${result.imported}; ${result.failures.length} rows failed`);
      } else {
        toast.success(`Imported ${result.imported} brand${result.imported === 1 ? "" : "s"}`);
      }
      onDone();
    },
    onError: (error) => toast.error(String(error).replace("Error: ", "")),
  });

  async function loadCsv(file: File | undefined) {
    if (!file) return;
    if (file.size > 2_000_000) {
      toast.error("CSV must be smaller than 2 MB");
      return;
    }
    const parsedRows = csvRows(await file.text());
    if (parsedRows.length === 0) {
      toast.error("CSV needs a header row and at least one brand");
      return;
    }
    setRows(parsedRows);
    setPreview(null);
    previewMutation.mutate(parsedRows);
  }

  function field(key: keyof typeof form, label: string, placeholder?: string, type = "text") {
    return (
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
        <Input
          type={type}
          value={form[key]}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              [key]: event.target.value,
            }))
          }
          placeholder={placeholder}
          className="rounded-xl"
        />
      </label>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="brand-library-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
    >
      <div className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="brand-library-title" className="text-lg font-semibold">
              Build your brand list
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Manual and CSV data always retain their source. No enrichment provider is configured.
            </p>
          </div>
          <Button size="icon" variant="ghost" aria-label="Close" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-4 flex gap-2" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "manual"}
            onClick={() => onModeChange("manual")}
            className={cn(
              "rounded-xl px-3 py-2 text-sm",
              mode === "manual"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            <Plus className="mr-1.5 inline h-4 w-4" /> Manual
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "csv"}
            onClick={() => onModeChange("csv")}
            className={cn(
              "rounded-xl px-3 py-2 text-sm",
              mode === "csv"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            <FileSpreadsheet className="mr-1.5 inline h-4 w-4" /> CSV
          </button>
        </div>

        {mode === "manual" ? (
          <form
            className="mt-5 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              createMutation.mutate();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {field("brandName", "Brand name *", "Acme Beauty")}
              {field("industry", "Industry", "Skincare")}
              {field("website", "Website", "https://example.com", "url")}
              {field("contactEmail", "Contact email", "partner@example.com", "email")}
              {field("contactName", "Contact name", "Alex Smith")}
              {field("contactTitle", "Contact title", "Creator Partnerships")}
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Notes</span>
              <textarea
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                rows={3}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={!form.brandName.trim() || createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save brand
              </Button>
            </div>
          </form>
        ) : (
          <div className="mt-5 space-y-4">
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center hover:bg-muted/50">
              <Upload className="h-7 w-7 text-muted-foreground" />
              <span className="mt-2 text-sm font-medium">Choose a CSV file</span>
              <span className="mt-1 text-xs text-muted-foreground">
                Columns: brand, industry, website, contact_name, contact_title, email, notes
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(event) => void loadCsv(event.target.files?.[0])}
              />
            </label>

            {previewMutation.isPending && (
              <p className="flex items-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Validating CSV…
              </p>
            )}
            {preview && (
              <>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-600">
                    {preview.validCount} ready
                  </span>
                  <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-600">
                    {preview.invalidCount} skipped
                  </span>
                </div>
                <div className="max-h-72 overflow-auto rounded-xl border border-border">
                  <table className="w-full min-w-[36rem] text-left text-xs">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Brand</th>
                        <th className="px-3 py-2">Contact</th>
                        <th className="px-3 py-2">Source</th>
                        <th className="px-3 py-2">Confidence</th>
                        <th className="px-3 py-2">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row) => (
                        <tr key={row.rowNumber} className="border-t border-border">
                          <td className="px-3 py-2">{row.rowNumber}</td>
                          <td className="px-3 py-2">{row.brandName || "—"}</td>
                          <td className="px-3 py-2">{row.contactEmail || "—"}</td>
                          <td className="px-3 py-2">
                            <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              {row.sourceLabel ?? row.source}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                                row.confidence === "high"
                                  ? "bg-emerald-500/15 text-emerald-300"
                                  : row.confidence === "medium"
                                    ? "bg-sky-500/15 text-sky-300"
                                    : "bg-amber-500/15 text-amber-300",
                              )}
                            >
                              {row.confidence ?? "medium"}
                            </span>
                          </td>
                          <td
                            className={cn(
                              "px-3 py-2",
                              row.valid ? "text-emerald-600" : "text-amber-600",
                            )}
                          >
                            {row.valid ? "Ready" : row.errors.join("; ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => importMutation.mutate()}
                    disabled={preview.validCount === 0 || importMutation.isPending}
                  >
                    {importMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Import {preview.validCount} valid rows
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function BrandCard({
  brand,
  index,
  highlighted,
  onOpen,
  onPitch,
  onSave,
  onReject,
  isPitching,
}: {
  brand: Brand;
  index: number;
  highlighted?: boolean;
  onOpen: () => void;
  onPitch: () => void;
  onSave: () => void;
  onReject: () => void;
  isPitching: boolean;
}) {
  const reduce = useReducedMotion();
  const score = brand.fit_score ?? brand.fit_quality_score ?? 0;
  const label = brand.match_label ?? labelFor(score);
  const pitched = brand.status === "pitched";
  const saved = brand.status === "saved";
  const dealRange = formatDeal(brand.estimated_deal_min, brand.estimated_deal_max);
  const reasons = (brand.top_reasons ?? []).filter(Boolean).slice(0, 2);
  const angle = (brand.partnership_angle || brand.outreach_angle || "").trim();
  const cappedDelay = Math.min(index, 8) * 0.04;

  return (
    <motion.div
      data-agent-id={`brands:${brand.id}`}
      variants={
        reduce
          ? { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.15 } } }
          : {
              hidden: { opacity: 0, y: 20, scale: 0.97 },
              show: {
                opacity: 1,
                y: 0,
                scale: 1,
                transition: { duration: 0.34, ease: [0.16, 1, 0.3, 1], delay: cappedDelay },
              },
            }
      }
      whileHover={reduce ? undefined : { y: -3, transition: { duration: 0.18 } }}
      className={cn(
        "group relative flex flex-col rounded-3xl border border-foreground/[0.06] bg-foreground/[0.03] p-5 text-left backdrop-blur-xl transition-[border-color,box-shadow] duration-200 hover:border-primary/30 hover:shadow-[0_20px_60px_rgba(0,0,0,0.5)]",
        highlighted &&
          "border-primary/60 shadow-[0_0_0_3px_hsl(var(--primary)/0.25)] animate-pulse",
      )}
    >
      <button type="button" onClick={onOpen} className="text-left">
        {/* Header: category + market */}
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          {brand.brand_industry && <span>{brand.brand_industry}</span>}
          {brand.market_type && (
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 font-semibold",
                brand.market_type === "local"
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                  : "border-sky-500/30 bg-sky-500/10 text-sky-300",
              )}
            >
              {brand.market_type === "local" ? "Local" : "Global"}
            </span>
          )}
        </div>

        {/* Brand name */}
        <h3 className="mt-2 break-words text-lg font-semibold leading-snug text-foreground">
          {brand.brand_name}
        </h3>

        {/* Score + label */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="shrink-0 text-2xl font-semibold tabular-nums text-foreground">
            {score}
            <span className="text-sm text-muted-foreground">/100</span>
          </span>
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              labelTone(label),
            )}
          >
            {label}
          </span>
          {dealRange && (
            <span className="break-words text-xs font-medium text-muted-foreground">
              {dealRange}
            </span>
          )}
        </div>

        {/* Top 2 reasons */}
        {reasons.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {reasons.map((r, i) => (
              <li key={i} className="flex gap-1.5 text-sm text-muted-foreground">
                <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-primary/70" />
                <span className="break-words">{r}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Best pitch angle (one line) */}
        {angle && (
          <p className="mt-3 break-words text-xs italic text-muted-foreground/80">Angle: {angle}</p>
        )}
      </button>

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2 border-t border-foreground/[0.05] pt-3">
        <Button
          size="sm"
          onClick={onPitch}
          disabled={isPitching || pitched}
          className="min-h-8 flex-1 rounded-lg text-xs"
        >
          {isPitching ? (
            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
          ) : (
            <Mail className="mr-1.5 h-3 w-3" />
          )}
          {pitched ? "Pitched" : "Generate Pitch"}
        </Button>
        <button
          type="button"
          onClick={onSave}
          aria-label="Save"
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-foreground/[0.08] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary",
            saved && "border-primary/40 bg-primary/10 text-primary",
          )}
        >
          <Heart className={cn("h-3.5 w-3.5", saved && "fill-current")} />
        </button>
        <button
          type="button"
          onClick={onReject}
          aria-label="Not a fit"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-foreground/[0.08] text-muted-foreground transition-colors hover:border-rose-500/40 hover:text-rose-300"
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

function BrandDetail({
  brand,
  onPitch,
  isPitching,
}: {
  brand: Brand;
  onPitch: () => void;
  isPitching: boolean;
}) {
  const score = brand.fit_score ?? brand.fit_quality_score ?? 0;
  const label = brand.match_label ?? labelFor(score);
  const dealRange = formatDeal(brand.estimated_deal_min, brand.estimated_deal_max);
  const breakdown = brand.score_breakdown;
  const deliverables = brand.suggested_deliverables ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {brand.brand_industry}
          {brand.market_type ? ` · ${brand.market_type === "local" ? "Local" : "Global"}` : ""}
        </p>
        <h2 className="mt-1 break-words text-2xl font-semibold">{brand.brand_name}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-3xl font-semibold tabular-nums">
            {score}
            <span className="text-base text-muted-foreground">/100</span>
          </span>
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wider",
              labelTone(label),
            )}
          >
            {label}
          </span>
          {dealRange && (
            <span className="ml-auto rounded-full bg-foreground/[0.05] px-3 py-1 text-xs text-foreground">
              {dealRange}
            </span>
          )}
        </div>
      </div>

      {/* Score breakdown */}
      {breakdown && (
        <Section title="Score breakdown">
          <div className="space-y-2.5">
            {SCORE_DIMENSIONS.map((d) => {
              const v = breakdown[d.key] ?? 0;
              return (
                <div key={d.key}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {d.label}
                      <span className="ml-1.5 opacity-60">({d.weight}%)</span>
                    </span>
                    <span className="font-semibold tabular-nums text-foreground">{v}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-foreground/[0.05]">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        v >= 80
                          ? "bg-emerald-400"
                          : v >= 60
                            ? "bg-primary"
                            : v >= 40
                              ? "bg-amber-400"
                              : "bg-rose-400",
                      )}
                      style={{ width: `${Math.max(2, v)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {brand.why_creator_fits && (
        <Section title="Why this brand fits the creator">
          <p className="text-sm leading-relaxed text-foreground">{brand.why_creator_fits}</p>
        </Section>
      )}

      {brand.why_brand_cares && (
        <Section title="Why the brand would care">
          <p className="text-sm leading-relaxed text-foreground">{brand.why_brand_cares}</p>
        </Section>
      )}

      {(brand.partnership_angle || brand.outreach_angle) && (
        <Section title="Best pitch angle">
          <p className="text-sm leading-relaxed text-foreground">
            {brand.partnership_angle || brand.outreach_angle}
          </p>
        </Section>
      )}

      {deliverables.length > 0 && (
        <Section title="Suggested deliverables">
          <ul className="space-y-1.5">
            {deliverables.map((d, i) => (
              <li key={i} className="flex gap-2 text-sm text-foreground">
                <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-primary/70" />
                <span className="break-words">{d}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div className="grid grid-cols-2 gap-3">
        {brand.best_outreach_channel && (
          <Stat label="Best channel" value={brand.best_outreach_channel} />
        )}
        {dealRange && <Stat label="Estimated deal" value={dealRange} />}
      </div>

      {brand.contact_path && (
        <Section title="Contact path">
          <p className="text-sm leading-relaxed text-foreground">{brand.contact_path}</p>
        </Section>
      )}

      {brand.what_to_avoid && (
        <Section title="What to avoid" tone="warn">
          <p className="text-sm leading-relaxed text-foreground">{brand.what_to_avoid}</p>
        </Section>
      )}

      <Button
        onClick={onPitch}
        disabled={isPitching || brand.status === "pitched"}
        className="w-full rounded-xl"
      >
        {isPitching ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Mail className="mr-2 h-4 w-4" />
        )}
        {brand.status === "pitched" ? "Already pitched" : "Generate Pitch"}
      </Button>
    </div>
  );
}

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone?: "warn";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl p-4",
        tone === "warn" ? "border border-amber-500/25 bg-amber-500/[0.05]" : "bg-foreground/[0.03]",
      )}
    >
      <p
        className={cn(
          "text-xs font-semibold uppercase tracking-wider",
          tone === "warn" ? "text-amber-300/90" : "text-muted-foreground",
        )}
      >
        {title}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-foreground/[0.03] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 break-words text-sm text-foreground">{value}</p>
    </div>
  );
}

export function SlideOver({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  const panelEase = [0.32, 0.72, 0, 1] as const;
  return (
    <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.18, ease: "easeOut" } }}
        exit={{ opacity: 0, transition: { duration: 0.14, ease: "easeIn" } }}
        className="absolute inset-0 bg-background/75"
        onClick={onClose}
      />
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0, transition: { duration: 0.34, ease: panelEase } }}
        exit={{ x: "100%", transition: { duration: 0.22, ease: panelEase } }}
        className="relative h-full w-full max-w-[520px] overflow-y-auto border-l border-foreground/10 bg-card p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground transition-all hover:scale-110 hover:bg-foreground/[0.06] hover:text-foreground active:scale-90"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="mt-6">{children}</div>
      </motion.aside>
    </div>
  );
}
