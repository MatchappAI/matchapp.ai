import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listCampaigns,
  upsertCampaign,
  toggleCampaign,
  deleteCampaign,
} from "@/lib/campaigns.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/campaigns")({
  head: () => ({ meta: [{ title: "Campaigns — MatchAI" }] }),
  component: CampaignsPage,
});

type Mode = "manual" | "approve_each" | "pre_approved";

type Campaign = {
  id: string;
  name: string;
  mode: Mode;
  brand_match_ids: string[];
  daily_send_cap: number;
  follow_up_count: number;
  stop_on_reply: boolean;
  stop_on_bounce: boolean;
  stop_on_unsubscribe: boolean;
  active: boolean;
};

function CampaignsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listCampaigns);
  const toggle = useServerFn(toggleCampaign);
  const del = useServerFn(deleteCampaign);
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => list({ data: {} as never }),
  });

  const toggleMut = useMutation({
    mutationFn: (p: { id: string; active: boolean }) => toggle({ data: p }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Campaign deleted");
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });

  const items: Campaign[] = (data?.campaigns ?? []) as Campaign[];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Campaigns</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Set the envelope once. I'll send inside it — daily caps, follow-ups,
            and stop rules included.
          </p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)} className="rounded-xl">
          <Plus className="mr-2 h-4 w-4" />
          {showForm ? "Cancel" : "New campaign"}
        </Button>
      </div>

      {showForm && (
        <CampaignForm
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            qc.invalidateQueries({ queryKey: ["campaigns"] });
          }}
        />
      )}

      {isLoading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-foreground/[0.04]" />
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-foreground/[0.06] bg-foreground/[0.03] p-8 text-center">
          <Info className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No campaigns yet. Create one to let the agent send without asking
            for every draft.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((c) => (
            <li
              key={c.id}
              data-agent-id={`campaigns:${c.id}`}
              className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.03] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold">{c.name}</p>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                        c.mode === "pre_approved"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : c.mode === "approve_each"
                            ? "bg-amber-500/15 text-amber-300"
                            : "bg-foreground/[0.08] text-muted-foreground",
                      )}
                    >
                      {c.mode.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.brand_match_ids.length} brands · {c.daily_send_cap}/day ·{" "}
                    {c.follow_up_count} follow-ups
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Stops on: {c.stop_on_reply && "reply "}{c.stop_on_bounce && "bounce "}
                    {c.stop_on_unsubscribe && "unsubscribe"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      toggleMut.mutate({ id: c.id, active: !c.active })
                    }
                    className="rounded-lg"
                  >
                    {c.active ? "Pause" : "Resume"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (window.confirm("Delete this campaign?")) delMut.mutate(c.id);
                    }}
                    className="rounded-lg text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CampaignForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const save = useServerFn(upsertCampaign);
  const [form, setForm] = useState({
    name: "",
    mode: "pre_approved" as Mode,
    brand_match_ids: "" as string,
    daily_send_cap: 10,
    follow_up_count: 2,
    stop_on_reply: true,
    stop_on_bounce: true,
    stop_on_unsubscribe: true,
    active: true,
    // Brief
    objective: "",
    target_audience: "",
    key_talking_points: "",
    deliverables: "",
    kpis: "",
    budget_min: "",
    budget_max: "",
    brand_voice_notes: "",
  });

  const mut = useMutation({
    mutationFn: () =>
      save({
        data: {
          name: form.name,
          mode: form.mode,
          brand_match_ids: form.brand_match_ids
            .split(/[\s,]+/)
            .map((s) => s.trim())
            .filter((s) => /^[0-9a-f-]{36}$/i.test(s)),
          daily_send_cap: form.daily_send_cap,
          follow_up_count: form.follow_up_count,
          min_deal_value_cents: 0,
          max_deal_value_cents: null,
          allow_package_offers: true,
          stop_on_reply: form.stop_on_reply,
          stop_on_bounce: form.stop_on_bounce,
          stop_on_unsubscribe: form.stop_on_unsubscribe,
          active: form.active,
          brief: {
            objective: form.objective,
            target_audience: form.target_audience,
            key_talking_points: form.key_talking_points,
            deliverables: form.deliverables,
            kpis: form.kpis,
            budget_min_cents: form.budget_min ? Math.round(Number(form.budget_min) * 100) : null,
            budget_max_cents: form.budget_max ? Math.round(Number(form.budget_max) * 100) : null,
            brand_voice_notes: form.brand_voice_notes,
          },
        },
      }),
    onSuccess: () => {
      toast.success("Campaign saved");
      onSaved();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });


  return (
    <div className="space-y-4 rounded-3xl border border-foreground/[0.06] bg-foreground/[0.03] p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">
            Campaign name
          </label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Skincare push — August"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">
            Mode
          </label>
          <div className="mt-1 flex gap-1 rounded-lg border border-foreground/[0.06] bg-foreground/[0.03] p-1">
            {(["pre_approved", "approve_each"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setForm({ ...form, mode: m })}
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-xs font-medium capitalize",
                  form.mode === m
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground",
                )}
              >
                {m.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">
            Brand match IDs (comma or newline separated)
          </label>
          <Input
            value={form.brand_match_ids}
            onChange={(e) =>
              setForm({ ...form, brand_match_ids: e.target.value })
            }
            placeholder="Paste UUIDs from your matches list"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">
            Daily send cap
          </label>
          <Input
            type="number"
            min={0}
            max={500}
            value={form.daily_send_cap}
            onChange={(e) =>
              setForm({ ...form, daily_send_cap: Number(e.target.value) })
            }
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">
            Follow-ups per brand
          </label>
          <Input
            type="number"
            min={0}
            value={form.follow_up_count}
            onChange={(e) =>
              setForm({ ...form, follow_up_count: Number(e.target.value) })
            }
          />

        </div>
      </div>

      <div className="space-y-4 border-t border-foreground/[0.06] pt-5">
        <div>
          <p className="text-sm font-semibold">Campaign brief</p>
          <p className="text-xs text-muted-foreground">
            Optional — the agent uses this as source-of-truth context for every
            outreach draft in this campaign.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Objective</label>
            <Input
              value={form.objective}
              onChange={(e) => setForm({ ...form, objective: e.target.value })}
              placeholder="Drive Q1 launch awareness with performance-minded creators"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Target audience</label>
            <Input
              value={form.target_audience}
              onChange={(e) => setForm({ ...form, target_audience: e.target.value })}
              placeholder="Women 22–34, US metros, fitness + wellness"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Key talking points</label>
            <Input
              value={form.key_talking_points}
              onChange={(e) => setForm({ ...form, key_talking_points: e.target.value })}
              placeholder="Clean formula, dermatologist-tested, launch discount"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Deliverables</label>
            <Input
              value={form.deliverables}
              onChange={(e) => setForm({ ...form, deliverables: e.target.value })}
              placeholder="1 Reel + 3 Stories"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">KPIs</label>
            <Input
              value={form.kpis}
              onChange={(e) => setForm({ ...form, kpis: e.target.value })}
              placeholder="Reach, saves, code redemptions"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Budget min ($)</label>
            <Input
              type="number"
              min={0}
              value={form.budget_min}
              onChange={(e) => setForm({ ...form, budget_min: e.target.value })}
              placeholder="500"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Budget max ($)</label>
            <Input
              type="number"
              min={0}
              value={form.budget_max}
              onChange={(e) => setForm({ ...form, budget_max: e.target.value })}
              placeholder="2500"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Brand voice notes</label>
            <Input
              value={form.brand_voice_notes}
              onChange={(e) => setForm({ ...form, brand_voice_notes: e.target.value })}
              placeholder="Warm, confident, no hype language"
            />
          </div>
        </div>
      </div>


      <div className="flex flex-wrap gap-4 text-sm">
        {(
          [
            ["stop_on_reply", "Stop on reply"],
            ["stop_on_bounce", "Stop on bounce"],
            ["stop_on_unsubscribe", "Stop on unsubscribe"],
          ] as const
        ).map(([k, l]) => (
          <label key={k} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.checked })}
              className="h-4 w-4 rounded border-foreground/20 bg-foreground/[0.05]"
            />
            {l}
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-2 border-t border-foreground/[0.06] pt-4">
        <Button variant="ghost" onClick={onClose} className="rounded-xl">
          Cancel
        </Button>
        <Button
          onClick={() => mut.mutate()}
          disabled={!form.name || mut.isPending}
          className="rounded-xl"
        >
          {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save campaign
        </Button>
      </div>
    </div>
  );
}
