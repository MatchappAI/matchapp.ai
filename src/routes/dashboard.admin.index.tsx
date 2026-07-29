import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getInsightsSummary } from "@/lib/insights.functions";

export const Route = createFileRoute("/dashboard/admin/")({
  component: InsightsPanel,
});

const fmt = (n: number) => new Intl.NumberFormat().format(n);
const usd = (cents: number | null) =>
  cents == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

function InsightsPanel() {
  const [days, setDays] = useState(30);
  const get = useServerFn(getInsightsSummary);
  const { data, isLoading, error } = useQuery({
    queryKey: ["insights", days],
    queryFn: () => get({ data: { days } }),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading insights…</div>;
  if (error) return <div className="text-sm text-destructive">{(error as Error).message}</div>;
  if (!data) return null;

  return (
    <div className="space-y-8">
      {/* Range */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Window:</span>
        {[7, 30, 90, 365].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`rounded-md border px-2 py-1 transition-colors ${
              days === d ? "border-foreground text-foreground" : "border-border/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      {/* Totals */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Users" value={fmt(data.totals.users)} />
        <Stat label="Activated" value={fmt(data.totals.activatedUsers)} />
        <Stat label="Events" value={fmt(data.totals.events)} />
        <Stat label="Paid deals" value={fmt(data.totals.paidDeals)} />
        <Stat label="Revenue" value={usd(data.totals.revenueCents)} />
        <Stat label="Feedback" value={fmt(data.totals.feedbackItems)} />
        <Stat label="Pricing signals" value={fmt(data.totals.pricingSignals)} />
        <Stat label="WTP median" value={usd(data.pricing.willingness.median)} />
      </section>

      {/* ICP */}
      <Section title="ICP — who pays" subtitle="Ranked by revenue, then user count.">
        <div className="grid gap-4 md:grid-cols-3">
          <IcpList title="By niche" rows={data.icp.byNiche} />
          <IcpList title="By follower tier" rows={data.icp.byFollowerTier} />
          <IcpList title="By location" rows={data.icp.byLocation} />
        </div>
      </Section>

      {/* Usage */}
      <Section title="Usage" subtitle="What users actually do.">
        <div className="grid gap-4 md:grid-cols-2">
          <Bars title="Top events" rows={data.usage.topEvents.map(([k, v]) => ({ k, v }))} />
          <Bars title="Top routes" rows={data.usage.topRoutes.map(([k, v]) => ({ k, v }))} />
        </div>
      </Section>

      {/* Feedback */}
      <Section title="Voice of customer" subtitle="ICP, painpoints, features, pricing, desires.">
        <div className="space-y-4">
          {data.feedback.length === 0 && (
            <div className="text-sm text-muted-foreground">No feedback captured yet.</div>
          )}
          {data.feedback.map((b) => (
            <div key={b.type} className="rounded-xl border border-border/40 bg-muted/10 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold capitalize">{b.type.replace("_", " ")}</h4>
                <span className="text-xs text-muted-foreground">{b.count} items</span>
              </div>
              <ul className="space-y-2">
                {b.recent.map((r) => (
                  <li key={r.id} className="rounded-lg border border-border/30 bg-background/40 p-3 text-sm">
                    <div>{r.content}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {r.source && <span>{r.source}</span>}
                      {r.route && <span>· {r.route}</span>}
                      {typeof r.sentiment === "number" && <span>· sentiment {r.sentiment}</span>}
                      <span>· {new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* Pricing */}
      <Section title="Pricing guidance" subtitle="Model preferences and willingness to pay.">
        <div className="grid gap-4 md:grid-cols-3">
          <Bars
            title="Model preference"
            rows={Object.entries(data.pricing.modelCounts).map(([k, v]) => ({ k, v }))}
          />
          <Bars
            title="Billing cadence"
            rows={Object.entries(data.pricing.cadenceCounts).map(([k, v]) => ({ k, v }))}
          />
          <div className="rounded-xl border border-border/40 bg-muted/10 p-4">
            <h4 className="mb-3 text-sm font-semibold">Willingness to pay</h4>
            <div className="space-y-2 text-sm">
              <Row k="P25" v={usd(data.pricing.willingness.p25)} />
              <Row k="Median" v={usd(data.pricing.willingness.median)} />
              <Row k="P75" v={usd(data.pricing.willingness.p75)} />
              <Row k="Samples" v={fmt(data.pricing.willingness.samples)} />
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-muted/10 p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}
function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
function Bars({ title, rows }: { title: string; rows: { k: string; v: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.v));
  return (
    <div className="rounded-xl border border-border/40 bg-muted/10 p-4">
      <h4 className="mb-3 text-sm font-semibold">{title}</h4>
      {rows.length === 0 ? (
        <div className="text-xs text-muted-foreground">No data yet.</div>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.k} className="text-xs">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="min-w-0 break-words pr-2">{r.k}</span>
                <span className="shrink-0 text-muted-foreground">{r.v}</span>
              </div>
              <div className="mt-1 h-1 rounded bg-muted/40">
                <div className="h-1 rounded bg-foreground/70" style={{ width: `${(r.v / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
function IcpList({ title, rows }: { title: string; rows: { key: string; users: number; revenue: number }[] }) {
  return (
    <div className="rounded-xl border border-border/40 bg-muted/10 p-4">
      <h4 className="mb-3 text-sm font-semibold">{title}</h4>
      {rows.length === 0 ? (
        <div className="text-xs text-muted-foreground">No data yet.</div>
      ) : (
        <ul className="space-y-2 text-sm">
          {rows.map((r) => (
            <li key={r.key} className="flex flex-wrap items-start justify-between gap-2">
              <span className="min-w-0 break-words pr-2">{r.key}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {usd(r.revenue * 100)} · {r.users}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
