import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyRoles } from "@/lib/insights.functions";

export const Route = createFileRoute("/dashboard/admin")({
  head: () => ({ meta: [{ title: "Admin — MatchAI" }, { name: "robots", content: "noindex" }] }),
  component: AdminLayout,
});

// Note: real server-side authorization lives inside every admin server function
// (see `getInsightsSummary` in src/lib/insights.functions.ts and any future
// admin fn). Non-staff callers get `throw new Error("Forbidden")` before any
// data is loaded, so the panel is safe even if a non-admin somehow reaches
// this URL. The client-side gate below is a UX affordance, not a security
// boundary.

function AdminLayout() {
  const get = useServerFn(getMyRoles);
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-roles"],
    queryFn: () => get({ data: {} as never }),
    retry: false,
  });
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Checking access…</div>;
  }
  if (error || !data?.isStaff) {
    return (
      <div className="rounded-xl border border-border/40 bg-muted/20 p-6 text-sm text-muted-foreground">
        This area is restricted. If you think you should have access, ask the workspace owner.
      </div>
    );
  }

  const tabs = [
    { to: "/dashboard/admin", label: "Insights" },
    { to: "/dashboard/admin/import", label: "Import" },
    { to: "/dashboard/admin/outreach", label: "Outreach" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Owner panel</h1>
        <p className="text-sm text-muted-foreground">Private to you. Not visible to creators.</p>
      </div>
      <nav className="flex gap-2 border-b border-border/40">
        {tabs.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className={`border-b-2 px-3 py-2 text-sm transition-colors ${
              pathname === t.to
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
