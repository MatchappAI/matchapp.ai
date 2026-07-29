import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAnalyticsOverview } from "@/lib/analytics.functions";
import { TrendingUp, DollarSign, Mail, Handshake, Percent } from "lucide-react";

export const Route = createFileRoute("/dashboard/analytics")({
  head: () => ({ meta: [{ title: "Analytics — MatchAI" }] }),
  component: AnalyticsPage,
});

function fmt(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

function Card({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof TrendingUp;
}) {
  return (
    <div className="rounded-3xl border border-foreground/[0.06] bg-foreground/[0.03] p-6">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {label}
      </div>
      <p className="text-3xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function AnalyticsPage() {
  const get = useServerFn(getAnalyticsOverview);
  const { data, isLoading } = useQuery({
    queryKey: ["analytics-overview"],
    queryFn: () => get({ data: {} as never }),
  });

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="h-40 animate-pulse rounded-3xl bg-foreground/[0.04]" />
      </div>
    );
  }

  const { money, outreach, pipeline } = data;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Where the money is, how outreach is landing, what's converting.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Money
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card label="Earned" value={fmt(money.earned)} icon={DollarSign} hint="Paid invoices" />
          <Card
            label="Pending"
            value={fmt(money.pending)}
            icon={DollarSign}
            hint="Deals in flight"
          />
          <Card
            label="Potential"
            value={`${fmt(money.potentialMin)}–${fmt(money.potentialMax)}`}
            icon={TrendingUp}
            hint="Open pipeline range"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Outreach
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card label="Sent" value={outreach.sent.toString()} icon={Mail} />
          <Card
            label="Open rate"
            value={`${outreach.openRate}%`}
            icon={Percent}
            hint={`${outreach.opened} opened`}
          />
          <Card
            label="Reply rate"
            value={`${outreach.replyRate}%`}
            icon={Percent}
            hint={`${outreach.replied} replied, ${outreach.genuine} genuine`}
          />
          <Card
            label="Bounces"
            value={outreach.bounced.toString()}
            icon={Mail}
            hint="Removed from sends"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Pipeline
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card
            label="Active matches"
            value={pipeline.activeMatches.toString()}
            icon={Handshake}
          />
          <Card
            label="Deals closed"
            value={pipeline.dealsClosed.toString()}
            icon={Handshake}
          />
          <Card
            label="Reply → close"
            value={`${pipeline.conversionRate}%`}
            icon={Percent}
            hint="Of genuine replies"
          />
        </div>
      </section>
    </div>
  );
}
