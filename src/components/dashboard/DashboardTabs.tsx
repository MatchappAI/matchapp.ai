import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Tab = { to: string; label: string };

const TABS: Tab[] = [
  { to: "/dashboard/deals", label: "Deals" },
  { to: "/dashboard/inbox", label: "Inbox" },
  { to: "/dashboard/tracker", label: "Tracker" },
  { to: "/dashboard/tools", label: "Tools" },
  { to: "/dashboard/settings", label: "Settings" },
];

export function DashboardTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="flex min-w-0 flex-wrap items-center gap-1 py-1">
      {TABS.map((t) => (
        <TabLink key={t.to} to={t.to} active={pathname.startsWith(t.to)} label={t.label} />
      ))}
    </nav>
  );
}

function TabLink({ to, active, label }: { to: string; active: boolean; label: string }) {
  return (
    <Link
      to={to}
      className={cn(
        "relative flex min-h-8 min-w-0 items-center rounded-lg px-2.5 py-1.5 text-[13px] font-medium leading-tight transition-colors sm:px-3",
        active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {active && (
        <motion.span
          layoutId="active-tab-pill"
          className="absolute inset-0 rounded-lg bg-primary shadow-[0_4px_20px_-4px_hsl(var(--primary)/0.5)]"
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
        />
      )}
      <span className="relative z-10 break-words">{label}</span>
    </Link>
  );
}
