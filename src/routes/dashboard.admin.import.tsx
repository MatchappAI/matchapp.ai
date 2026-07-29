import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { importInternalRows, previewInternalImport } from "@/lib/internal-outreach.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/admin/import")({
  head: () => ({ meta: [{ title: "Import — MatchAI" }] }),
  component: InternalImportPage,
});

type ImportKind =
  | "brand"
  | "creator"
  | "contact"
  | "buying_intent_signal"
  | "brand_opportunity"
  | "campaign_brief"
  | "product_drop"
  | "outreach_target";

type ParsedRow = Record<string, string> & { rowNumber: number };

const KIND_OPTIONS: Array<{ id: ImportKind; label: string; help: string }> = [
  { id: "brand", label: "Brands", help: "Seeds Brand Discovery and brand contacts." },
  { id: "creator", label: "Creators", help: "Seeds internal creator outreach targets." },
  { id: "contact", label: "Contacts", help: "Adds normalized internal contacts." },
  { id: "buying_intent_signal", label: "Buying intent", help: "Creates signals and review items." },
  { id: "brand_opportunity", label: "Opportunities", help: "Creates scoring-ready opportunities." },
  { id: "campaign_brief", label: "Campaign briefs", help: "Stores internal campaign direction." },
  { id: "product_drop", label: "Product drops", help: "Normalizes launches into intent signals." },
  { id: "outreach_target", label: "Outreach targets", help: "Queues inbox drafts for approval." },
];

const FIELD_MAP: Record<ImportKind, Record<string, string>> = {
  brand: {
    brand: "brand_name",
    brand_name: "brand_name",
    name: "brand_name",
    industry: "industry",
    category: "industry",
    website: "website",
    url: "website",
    contact_name: "contact_name",
    contact: "contact_name",
    contact_title: "contact_title",
    title: "contact_title",
    contact_email: "contact_email",
    email: "contact_email",
    notes: "notes",
    source_url: "source_url",
  },
  creator: {
    creator: "creator_name",
    creator_name: "creator_name",
    name: "creator_name",
    handle: "handle",
    platform: "platform",
    niche: "niche",
    audience_tags: "audience_tags",
    tone_tags: "tone_tags",
    rate_floor: "rate_floor",
    rate_target: "rate_target",
    follower_count: "follower_count",
    engagement_rate: "engagement_rate",
    email: "email",
    notes: "notes",
    assignee: "assignee",
  },
  contact: {
    display_name: "display_name",
    name: "display_name",
    company: "company_name",
    company_name: "company_name",
    email: "email",
    target_type: "target_type",
    direction: "direction",
    platform: "platform",
    audience_tags: "audience_tags",
    tone_tags: "tone_tags",
    notes: "notes",
  },
  buying_intent_signal: {
    brand: "brand_name",
    brand_name: "brand_name",
    website: "website",
    signal_type: "signal_type",
    signal_summary: "signal_summary",
    signal_name: "signal_name",
    signal_date: "signal_date",
    source_url: "source_url",
    product_drop_name: "product_drop_name",
    opportunity_type: "opportunity_type",
    estimated_pay_min: "estimated_pay_min",
    estimated_pay_max: "estimated_pay_max",
    urgency_score: "urgency_score",
    ease_to_close_score: "ease_to_close_score",
    fast_pay_score: "fast_pay_score",
    notes: "notes",
  },
  brand_opportunity: {
    brand: "brand_name",
    brand_name: "brand_name",
    website: "website",
    opportunity_title: "opportunity_title",
    opportunity_type: "opportunity_type",
    signal_type: "signal_type",
    signal_summary: "signal_summary",
    why_now: "why_now",
    source_url: "source_url",
    estimated_pay_min: "estimated_pay_min",
    estimated_pay_max: "estimated_pay_max",
    fit_score: "fit_score",
    cash_likelihood_score: "cash_likelihood_score",
    fast_pay_score: "fast_pay_score",
    pitch_angle: "pitch_angle",
    contact_readiness: "contact_readiness",
    risks: "risks",
    creator_preference_fit: "creator_preference_fit",
    competition_risk: "competition_risk",
    notes: "notes",
  },
  campaign_brief: {
    title: "title",
    direction: "direction",
    brand: "brand_name",
    brand_name: "brand_name",
    summary: "summary",
    objective: "objective",
    audience: "audience",
    deliverables: "deliverables",
    budget_min: "budget_min",
    budget_max: "budget_max",
    pitch_angle: "pitch_angle",
    contact_hint: "contact_hint",
    source_url: "source_url",
    notes: "notes",
    priority: "priority",
  },
  product_drop: {
    brand: "brand_name",
    brand_name: "brand_name",
    website: "website",
    product_drop_name: "product_drop_name",
    signal_type: "signal_type",
    signal_summary: "signal_summary",
    signal_date: "signal_date",
    source_url: "source_url",
    estimated_pay_min: "estimated_pay_min",
    estimated_pay_max: "estimated_pay_max",
    urgency_score: "urgency_score",
    ease_to_close_score: "ease_to_close_score",
    fast_pay_score: "fast_pay_score",
    notes: "notes",
  },
  outreach_target: {
    target_type: "target_type",
    direction: "direction",
    display_name: "display_name",
    company: "company_name",
    company_name: "company_name",
    email: "email",
    cc: "cc",
    bcc: "bcc",
    reply_to: "reply_to",
    source_record_type: "source_record_type",
    source_record_id: "source_record_id",
    notes: "notes",
    assignee: "assignee",
    status: "status",
  },
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

function slugifyHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function mapCsvRows(kind: ImportKind, text: string): ParsedRow[] {
  const parsed = parseCsv(text);
  if (parsed.length < 2) return [];
  const headers = parsed[0].map((header) => FIELD_MAP[kind][slugifyHeader(header)]);
  return parsed.slice(1).map((values, index) => {
    const row: ParsedRow = { rowNumber: index + 2 };
    headers.forEach((header, column) => {
      if (header) {
        row[header] = values[column] ?? "";
      }
    });
    return row;
  });
}

function InternalImportPage() {
  const qc = useQueryClient();
  const previewFn = useServerFn(previewInternalImport);
  const importFn = useServerFn(importInternalRows);
  const [kind, setKind] = useState<ImportKind>("brand");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewFn>> | null>(null);

  const previewMut = useMutation({
    mutationFn: (inputRows: ParsedRow[]) =>
      previewFn({ data: { kind, sourceLabel: "csv", rows: inputRows } }),
    onSuccess: setPreview,
    onError: (error) => toast.error(String(error).replace("Error: ", "")),
  });

  const importMut = useMutation({
    mutationFn: () => importFn({ data: { kind, sourceLabel: "csv", rows } }),
    onSuccess: (result) => {
      toast.success(`Imported ${result.imported} row${result.imported === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["discovery-brands"] });
      qc.invalidateQueries({ queryKey: ["discovery-creator"] });
      qc.invalidateQueries({ queryKey: ["discovery-review"] });
      qc.invalidateQueries({ queryKey: ["brand-matches"] });
      qc.invalidateQueries({ queryKey: ["creator-deals"] });
      qc.invalidateQueries({ queryKey: ["internal-outreach"] });
      setPreview(null);
      setRows([]);
    },
    onError: (error) => toast.error(String(error).replace("Error: ", "")),
  });

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 2_000_000) {
      toast.error("CSV must be smaller than 2 MB");
      return;
    }
    const parsedRows = mapCsvRows(kind, await file.text());
    if (parsedRows.length === 0) {
      toast.error("CSV needs a header row and at least one row");
      return;
    }
    setRows(parsedRows);
    setPreview(null);
    previewMut.mutate(parsedRows);
  }

  const current = useMemo(
    () => KIND_OPTIONS.find((option) => option.id === kind) ?? KIND_OPTIONS[0],
    [kind],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="rounded-3xl border border-foreground/[0.06] bg-gradient-to-br from-card via-card to-primary/5 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Internal Import
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Import brands, signals, and outreach targets
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          CSV/manual-first. No paid enrichment provider is required. Imported rows are normalized
          into the same discovery and outreach tables so the rest of the product keeps working from
          one source of truth.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-4 rounded-3xl border border-foreground/[0.06] bg-foreground/[0.03] p-5">
          <div>
            <h2 className="text-base font-semibold">Import type</h2>
            <p className="text-xs text-muted-foreground">{current.help}</p>
          </div>
          <div className="space-y-2">
            {KIND_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setKind(option.id);
                  setRows([]);
                  setPreview(null);
                }}
                className={cn(
                  "w-full rounded-2xl border px-4 py-3 text-left transition-colors",
                  kind === option.id
                    ? "border-primary/40 bg-primary/10"
                    : "border-foreground/[0.06] bg-card hover:bg-foreground/[0.03]",
                )}
              >
                <div className="font-medium">{option.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">{option.help}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-3xl border border-foreground/[0.06] bg-card p-5">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-foreground/[0.12] p-10 text-center">
            <Upload className="h-7 w-7 text-muted-foreground" />
            <span className="mt-2 text-sm font-medium">Choose a CSV file</span>
            <span className="mt-1 text-xs text-muted-foreground">
              Headers are mapped per import type. Preview shows validation, duplicates, source, and
              confidence.
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => void onFile(event.target.files?.[0])}
            />
          </label>

          {(previewMut.isPending || importMut.isPending) && (
            <p className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {importMut.isPending ? "Importing rows…" : "Validating preview…"}
            </p>
          )}

          {preview && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-300">
                  {preview.validCount} ready
                </span>
                <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-300">
                  {preview.invalidCount} skipped
                </span>
              </div>

              <div className="max-h-[32rem] overflow-auto rounded-2xl border border-foreground/[0.06]">
                <table className="w-full min-w-[52rem] text-left text-xs">
                  <thead className="sticky top-0 bg-card">
                    <tr className="text-muted-foreground">
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Primary</th>
                      <th className="px-3 py-2">Source</th>
                      <th className="px-3 py-2">Confidence</th>
                      <th className="px-3 py-2">Duplicate</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr key={row.rowNumber} className="border-t border-foreground/[0.06]">
                        <td className="px-3 py-2">{row.rowNumber}</td>
                        <td className="px-3 py-2">
                          {String(
                            row.brand_name ??
                              row.creator_name ??
                              row.display_name ??
                              row.opportunity_title ??
                              row.title ??
                              row.signal_summary ??
                              "—",
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {kind}
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
                            {String(row.confidence ?? "medium")}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {row.duplicateExisting || row.duplicateInFile ? "Yes" : "No"}
                        </td>
                        <td
                          className={cn(
                            "px-3 py-2",
                            row.valid ? "text-emerald-300" : "text-amber-300",
                          )}
                        >
                          {row.valid
                            ? "Ready"
                            : Array.isArray(row.errors)
                              ? row.errors.join("; ")
                              : "Invalid"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPreview(null);
                    setRows([]);
                  }}
                >
                  Clear
                </Button>
                <Button onClick={() => importMut.mutate()} disabled={preview.validCount === 0}>
                  Import {preview.validCount} valid rows
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
