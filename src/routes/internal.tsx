import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  BarChart3,
  Bot,
  FileSpreadsheet,
  Inbox,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import { getMyRoles } from "@/lib/insights.functions";

export const Route = createFileRoute("/internal")({
  head: () => ({
    meta: [
      { title: "Internal — MatchAI" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InternalHome,
});

function InternalHome() {
  const get = useServerFn(getMyRoles);
  const { data } = useQuery({
    queryKey: ["internal-my-roles"],
    queryFn: () => get({ data: {} as never }),
    retry: false,
  });

  if (!data?.isStaff) {
    return (
      <div className="mx-auto max-w-4xl rounded-3xl border border-foreground/[0.06] bg-foreground/[0.03] p-8 text-sm text-muted-foreground">
        Access is restricted to internal operators.
      </div>
    );
  }

  const cards = [
    {
      title: "Operations overview",
      body: "A quick read on discovery, outreach, inbox activity, queues, and provider state.",
      to: "/dashboard/admin",
      icon: BarChart3,
    },
    {
      title: "Discovery review",
      body: "Approve matches, inspect evidence, and publish opportunities to creators.",
      to: "/dashboard/discovery/review",
      icon: Sparkles,
    },
    {
      title: "Import pipeline",
      body: "Load creators, brands, and contacts from CSV or manual records.",
      to: "/dashboard/admin/import",
      icon: FileSpreadsheet,
    },
    {
      title: "Outreach tooling",
      body: "Create approved drafts, target lists, and internal outreach targets.",
      to: "/dashboard/admin/outreach",
      icon: Inbox,
    },
    {
      title: "Creator discovery",
      body: "Inspect creator fit, reverse scoring, and discovery signals.",
      to: "/dashboard/discovery/creator",
      icon: Users,
    },
    {
      title: "System controls",
      body: "Review audit history, support queues, and provider readiness.",
      to: "/dashboard/admin",
      icon: Shield,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="rounded-3xl border border-foreground/[0.06] bg-gradient-to-br from-card via-card to-primary/5 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          MatchAI Internal
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Operator workspace</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          This area is for staff-only review, imports, discovery, and operational cleanup. It is
          intentionally separated from the creator product and hidden from creator navigation.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.title}
              to={card.to as never}
              className="rounded-3xl border border-foreground/[0.06] bg-foreground/[0.03] p-5 transition-transform hover:-translate-y-0.5 hover:bg-foreground/[0.05]"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold">{card.title}</h2>
                  <p className="text-xs text-muted-foreground">{card.body}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm font-medium text-primary">
                Open <ArrowRight className="ml-2 h-4 w-4" />
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <section className="rounded-3xl border border-foreground/[0.06] bg-foreground/[0.03] p-5">
          <h2 className="text-lg font-semibold">Internal boundaries</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>Creators cannot see this route through the normal dashboard navigation.</li>
            <li>Server checks still decide whether the current user is staff.</li>
            <li>Internal workflows reuse the same shared discovery and outreach backend.</li>
          </ul>
        </section>
        <section className="rounded-3xl border border-foreground/[0.06] bg-foreground/[0.03] p-5">
          <h2 className="text-lg font-semibold">Shortcuts</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link className="rounded-full border border-foreground/[0.08] px-3 py-1.5 text-sm" to="/dashboard/admin">
              Overview
            </Link>
            <Link className="rounded-full border border-foreground/[0.08] px-3 py-1.5 text-sm" to="/dashboard/admin/import">
              Import
            </Link>
            <Link className="rounded-full border border-foreground/[0.08] px-3 py-1.5 text-sm" to="/dashboard/admin/outreach">
              Outreach
            </Link>
            <Link className="rounded-full border border-foreground/[0.08] px-3 py-1.5 text-sm" to="/dashboard/discovery">
              Discovery
            </Link>
          </div>
        </section>
      </div>

      <Outlet />
    </div>
  );
}
