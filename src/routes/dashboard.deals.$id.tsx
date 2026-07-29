import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Sparkles, Send, Plus, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getDealDetail,
  listDeliverables,
  createDeliverable,
  updateDeliverableStatus,
  listNegotiationMessages,
  addNegotiationMessage,
  generateNegotiationCounter,
  updateDealTerms,
} from "@/lib/matchai-extra.functions";
import { flagDealDispute } from "@/lib/dispute.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/deals/$id")({
  head: () => ({ meta: [{ title: "Deal — MatchAI" }] }),
  component: DealDetailPage,
});

type Tab = "terms" | "negotiate" | "deliverables";

function DealDetailPage() {
  const { id } = Route.useParams();
  const [tab, setTab] = useState<Tab>("terms");
  const get = useServerFn(getDealDetail);
  const { data, isLoading } = useQuery({
    queryKey: ["deal", id],
    queryFn: () => get({ data: { deal_id: id } }),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="h-40 animate-pulse rounded-3xl bg-foreground/[0.04]" />
      </div>
    );
  }
  if (!data?.deal) {
    return (
      <div className="mx-auto max-w-5xl text-center text-muted-foreground">
        Deal not found.
      </div>
    );
  }
  const d = data.deal;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        to="/dashboard/deals"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All deals
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {d.status}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{d.brand_name}</h1>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Value</p>
          <p className="text-2xl font-semibold">
            {d.deal_value ? `$${Number(d.deal_value).toLocaleString()}` : "TBD"}
          </p>
        </div>
      </div>

      <div className="flex gap-1 rounded-xl border border-foreground/[0.06] bg-foreground/[0.03] p-1 w-fit">
        {(["terms", "negotiate", "deliverables"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-medium capitalize",
              tab === t
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "terms" && <TermsPanel deal={d} />}
      {tab === "negotiate" && <NegotiatePanel dealId={id} />}
      {tab === "deliverables" && <DeliverablesPanel dealId={id} />}
    </div>
  );
}

function TermsPanel({ deal }: { deal: Record<string, any> }) {
  const qc = useQueryClient();
  const update = useServerFn(updateDealTerms);
  const [form, setForm] = useState({
    deal_value: deal.deal_value?.toString() ?? "",
    timeline_days: deal.timeline_days?.toString() ?? "",
    usage_rights: deal.usage_rights ?? "",
    exclusivity: deal.exclusivity ?? "",
    deliverables: deal.deliverables ?? "",
    payment_terms: deal.payment_terms ?? "",
    revision_limit: deal.revision_limit?.toString() ?? "",
    package_name: deal.package_name ?? "",
  });
  const save = useMutation({
    mutationFn: () =>
      update({
        data: {
          deal_id: deal.id,
          deal_value: form.deal_value ? Number(form.deal_value) : undefined,
          timeline_days: form.timeline_days ? Number(form.timeline_days) : undefined,
          usage_rights: form.usage_rights || undefined,
          exclusivity: form.exclusivity || undefined,
          deliverables: form.deliverables || undefined,
          payment_terms: form.payment_terms || undefined,
          revision_limit: form.revision_limit ? Number(form.revision_limit) : undefined,
          package_name: form.package_name || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Deal terms saved");
      qc.invalidateQueries({ queryKey: ["deal", deal.id] });
      qc.invalidateQueries({ queryKey: ["deals-pipeline"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save terms"),
  });


  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-4 rounded-3xl border border-foreground/[0.06] bg-foreground/[0.03] p-6">
        <h2 className="text-lg font-semibold">Deal terms</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Package name">
            <Input
              value={form.package_name}
              onChange={(e) => setForm({ ...form, package_name: e.target.value })}
            />
          </Field>
          <Field label="Deal value (USD)">
            <Input
              type="number"
              value={form.deal_value}
              onChange={(e) => setForm({ ...form, deal_value: e.target.value })}
            />
          </Field>
          <Field label="Timeline (days)">
            <Input
              type="number"
              value={form.timeline_days}
              onChange={(e) => setForm({ ...form, timeline_days: e.target.value })}
            />
          </Field>
          <Field label="Revisions allowed">
            <Input
              type="number"
              value={form.revision_limit}
              onChange={(e) => setForm({ ...form, revision_limit: e.target.value })}
            />
          </Field>
          <Field label="Payment terms">
            <Input
              value={form.payment_terms}
              onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
              placeholder="Net 30, 50/50, etc."
            />
          </Field>
          <Field label="Usage rights">
            <Input
              value={form.usage_rights}
              onChange={(e) => setForm({ ...form, usage_rights: e.target.value })}
            />
          </Field>
          <Field label="Exclusivity" full>
            <Input
              value={form.exclusivity}
              onChange={(e) => setForm({ ...form, exclusivity: e.target.value })}
            />
          </Field>
          <Field label="Deliverables" full>
            <Textarea
              rows={4}
              value={form.deliverables}
              onChange={(e) => setForm({ ...form, deliverables: e.target.value })}
            />
          </Field>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full rounded-xl">
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save terms
        </Button>
      </div>

      <div className="space-y-3 rounded-3xl border border-foreground/[0.06] bg-foreground/[0.03] p-6 h-fit">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Summary
        </h3>
        <SummaryRow k="Brand" v={deal.brand_name} />
        <SummaryRow k="Value" v={form.deal_value ? `$${Number(form.deal_value).toLocaleString()}` : "—"} />
        <SummaryRow k="Timeline" v={form.timeline_days ? `${form.timeline_days} days` : "—"} />
        <SummaryRow k="Package" v={form.package_name || "—"} />
        <SummaryRow k="Contract" v={deal.contract_status} />
        <SummaryRow k="Protected payment" v={deal.escrow_status} />
        <SummaryRow k="Invoice" v={deal.invoice_status} />
        <div className="border-t border-foreground/[0.06] pt-3">
          <FlagProblemButton dealId={deal.id} />
        </div>
      </div>
    </div>
  );
}

function FlagProblemButton({ dealId }: { dealId: string }) {
  const flag = useServerFn(flagDealDispute);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const mut = useMutation({
    mutationFn: () => flag({ data: { deal_id: dealId, reason } }),
    onSuccess: () => {
      toast.success("Flagged. Your protected payment is on hold pending review.");
      setOpen(false);
      setReason("");
      qc.invalidateQueries({ queryKey: ["deal", dealId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not flag"),
  });
  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border-destructive/40 text-destructive hover:bg-destructive/10"
      >
        <Flag className="mr-2 h-4 w-4" /> Flag a problem
      </Button>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Freezes any protected payment until reviewed. Tell us what went wrong.
      </p>
      <Textarea
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Deliverables changed, payment late, brand unresponsive…"
      />
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="rounded-lg">
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => mut.mutate()}
          disabled={reason.trim().length < 8 || mut.isPending}
          className="rounded-lg"
        >
          {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit flag
        </Button>
      </div>
    </div>
  );
}

function SummaryRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium capitalize">{v}</span>
    </div>
  );
}

function NegotiatePanel({ dealId }: { dealId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listNegotiationMessages);
  const add = useServerFn(addNegotiationMessage);
  const counter = useServerFn(generateNegotiationCounter);
  const [text, setText] = useState("");
  const [sender, setSender] = useState<"creator" | "brand">("creator");
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["negotiation", dealId],
    queryFn: () => list({ data: { deal_id: dealId } }),
  });

  const addMut = useMutation({
    mutationFn: (p: { ai_recommendation?: boolean }) =>
      add({ data: { deal_id: dealId, sender, message_text: text, ai_recommendation: p.ai_recommendation } }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["negotiation", dealId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add message"),
  });
  const counterMut = useMutation({
    mutationFn: () => counter({ data: { deal_id: dealId } }),
    onSuccess: (r) => {
      if (r.ok) {
        setSuggestion(r.suggestion);
        setText(r.suggestion);
        setSender("creator");
      } else toast.error(r.error);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not generate counter"),
  });


  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="rounded-3xl border border-foreground/[0.06] bg-foreground/[0.03] p-6">
        <h2 className="mb-4 text-lg font-semibold">Negotiation thread</h2>
        <div className="mb-4 max-h-[420px] space-y-3 overflow-y-auto pr-2">
          {(data?.messages ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              No messages yet. Start the thread or generate a counter.
            </p>
          )}
          {(data?.messages ?? []).map((m: any) => (
            <div
              key={m.id}
              className={cn(
                "max-w-[80%] rounded-2xl p-3 text-sm",
                m.sender === "creator"
                  ? "ml-auto bg-primary/15 text-foreground"
                  : "bg-foreground/[0.04] text-foreground",
              )}
            >
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {m.sender} {m.ai_recommendation && "· AI"}
              </p>
              <p className="whitespace-pre-wrap">{m.message_text}</p>
            </div>
          ))}
        </div>
        <div className="space-y-2 border-t border-foreground/[0.06] pt-4">
          <div className="flex gap-1 rounded-lg bg-foreground/[0.04] p-1 w-fit">
            {(["creator", "brand"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSender(s)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs capitalize",
                  sender === s ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <Textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message…"
          />
          <Button
            onClick={() => addMut.mutate({ ai_recommendation: !!suggestion })}
            disabled={!text || addMut.isPending}
            className="w-full rounded-xl"
          >
            <Send className="mr-2 h-4 w-4" /> Add to thread
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-3xl border border-primary/20 bg-primary/[0.05] p-6 h-fit">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> AI guardrails
        </h3>
        <p className="text-xs text-muted-foreground">
          Generate a counter-offer that stays above your walk-away rate and pushes toward target.
        </p>
        <Button
          onClick={() => counterMut.mutate()}
          disabled={counterMut.isPending}
          className="w-full rounded-xl"
        >
          {counterMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Suggest counter
        </Button>
      </div>
    </div>
  );
}

function DeliverablesPanel({ dealId }: { dealId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listDeliverables);
  const create = useServerFn(createDeliverable);
  const upd = useServerFn(updateDeliverableStatus);
  const [form, setForm] = useState({
    deliverable_type: "Instagram Reel",
    file_url: "",
    caption_draft: "",
    post_date: "",
    notes: "",
  });
  const [showForm, setShowForm] = useState(false);

  const { data } = useQuery({
    queryKey: ["deliverables", dealId],
    queryFn: () => list({ data: { deal_id: dealId } }),
  });

  const addMut = useMutation({
    mutationFn: () => create({ data: { deal_id: dealId, ...form, file_url: form.file_url || undefined } }),
    onSuccess: () => {
      toast.success("Deliverable added");
      setForm({ deliverable_type: "Instagram Reel", file_url: "", caption_draft: "", post_date: "", notes: "" });
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["deliverables", dealId] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const updMut = useMutation({
    mutationFn: (p: { id: string; status: string; revision_notes?: string }) =>
      upd({ data: { id: p.id, status: p.status as any, revision_notes: p.revision_notes } }),
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["deliverables", dealId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update deliverable"),
  });


  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowForm((s) => !s)} className="rounded-xl">
          <Plus className="mr-2 h-4 w-4" /> {showForm ? "Cancel" : "Add deliverable"}
        </Button>
      </div>

      {showForm && (
        <div className="space-y-3 rounded-3xl border border-foreground/[0.06] bg-foreground/[0.03] p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Type">
              <Input
                value={form.deliverable_type}
                onChange={(e) => setForm({ ...form, deliverable_type: e.target.value })}
              />
            </Field>
            <Field label="Post date">
              <Input
                type="date"
                value={form.post_date}
                onChange={(e) => setForm({ ...form, post_date: e.target.value })}
              />
            </Field>
            <Field label="File URL" full>
              <Input
                value={form.file_url}
                onChange={(e) => setForm({ ...form, file_url: e.target.value })}
                placeholder="https://…"
              />
            </Field>
            <Field label="Caption draft" full>
              <Textarea
                rows={3}
                value={form.caption_draft}
                onChange={(e) => setForm({ ...form, caption_draft: e.target.value })}
              />
            </Field>
            <Field label="Notes" full>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>
          <Button onClick={() => addMut.mutate()} disabled={addMut.isPending} className="rounded-xl">
            {addMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {(data?.deliverables ?? []).length === 0 && (
          <p className="rounded-3xl border border-foreground/[0.06] bg-foreground/[0.03] p-8 text-center text-sm text-muted-foreground">
            No deliverables yet.
          </p>
        )}
        {(data?.deliverables ?? []).map((dl: any) => (
          <div key={dl.id} className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.03] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{dl.deliverable_type}</p>
                <p className="text-xs text-muted-foreground">
                  {dl.post_date ?? "No post date"} ·{" "}
                  <span className="capitalize">{dl.status.replace(/_/g, " ")}</span>
                </p>
                {dl.file_url && (
                  <a
                    href={dl.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    {dl.file_url}
                  </a>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {["approved", "revision_requested", "posted"].map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={dl.status === s ? "default" : "outline"}
                    onClick={() => updMut.mutate({ id: dl.id, status: s })}
                    className="rounded-lg capitalize"
                  >
                    {s.replace(/_/g, " ")}
                  </Button>
                ))}
              </div>
            </div>
            {dl.caption_draft && (
              <p className="mt-3 whitespace-pre-wrap rounded-xl bg-foreground/[0.03] p-3 text-sm text-muted-foreground">
                {dl.caption_draft}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={cn("space-y-1.5", full && "sm:col-span-2")}>
      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
