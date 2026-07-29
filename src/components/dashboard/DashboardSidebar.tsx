import { Link, useRouterState } from "@tanstack/react-router";
import {
  Inbox,
  Briefcase,
  BarChart3,
  Wrench,
  Settings,
  Menu,
  X,
  Shield,
  type LucideIcon,
} from "lucide-react";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { MatchAILogo } from "@/components/brand/MatchAILogo";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: LucideIcon };
type NavGroup = { label: string | null; items: NavItem[] };

// Keep the creator journey narrow. Discovery, campaigns, approvals, billing,
// and owner tooling remain routable compatibility surfaces but are not primary
// creator destinations.
const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { to: "/dashboard/deals", label: "Deals", icon: Briefcase },
      { to: "/dashboard/inbox", label: "Inbox", icon: Inbox },
      { to: "/dashboard/tracker", label: "Tracker", icon: BarChart3 },
      { to: "/dashboard/tools", label: "Tools", icon: Wrench },
    ],
  },
  {
    label: null,
    items: [{ to: "/dashboard/settings", label: "Settings", icon: Settings }],
  },
];

type Props = {
  fullName: string | null;
  tier: string;
  avatarUrl?: string | null;
  verified?: boolean;
  verifiedHandle?: string | null;
  verifiedPlatform?: string | null;
  isStaff?: boolean;
};

export function DashboardSidebar({
  fullName,
  tier,
  avatarUrl,
  verified,
  verifiedHandle,
  verifiedPlatform,
  isStaff,
}: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const reduce = useReducedMotion();

  const navGroups: NavGroup[] = isStaff
    ? [
        ...NAV_GROUPS,
        {
          label: "Owner",
          items: [
            { to: "/internal", label: "Internal hub", icon: Shield },
            { to: "/dashboard/admin", label: "Insights", icon: Shield },
          ],
        },
      ]
    : NAV_GROUPS;

  const drawerEase = [0.32, 0.72, 0, 1] as const;

  const sidebarBody = (onNav?: () => void) => (
    <>
      {/* Logo */}
      <div className="flex items-center justify-between px-6 pb-2 pt-6">
        <Link to="/" className="flex items-center transition-opacity hover:opacity-80">
          <MatchAILogo size="sm" />
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-6">
        {navGroups.map((group, gi) => (
          <div key={gi} className="space-y-1">
            {group.label && (
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const active =
                item.to === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onNav}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="active-nav-pill"
                      className="absolute inset-0 rounded-xl bg-primary shadow-[0_8px_24px_-8px_oklch(0_0_0/0.22)]"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-3 transition-transform duration-150 ease-out group-hover:translate-x-[3px]">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User card */}
      <div className="border-t border-foreground/5 px-3 py-4">
        <div className="flex items-center gap-3 rounded-xl bg-foreground/[0.03] px-3 py-3">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-primary hover:bg-primary/90 transition-colors text-sm font-semibold text-primary-foreground">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={fullName ?? "avatar"}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              (fullName ?? "U").slice(0, 1).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="break-words text-sm font-medium text-foreground">
              {fullName ?? "Creator"}
            </p>
            <p className="break-words text-xs text-muted-foreground">{tier}</p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile menu toggle */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-50 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-foreground/10 bg-card/80 backdrop-blur transition-all hover:scale-105 active:scale-95 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5 text-foreground" />
      </button>

      {/* Desktop sidebar — always visible */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[220px] flex-col border-r border-foreground/5 bg-card/40 backdrop-blur-xl lg:flex">
        {sidebarBody()}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.28 } }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              key="drawer"
              initial={reduce ? { opacity: 0 } : { x: -280 }}
              animate={
                reduce
                  ? { opacity: 1, transition: { duration: 0.15 } }
                  : { x: 0, transition: { duration: 0.32, ease: drawerEase } }
              }
              exit={
                reduce
                  ? { opacity: 0, transition: { duration: 0.15 } }
                  : { x: -280, transition: { duration: 0.24, ease: drawerEase } }
              }
              className="fixed left-0 top-0 z-50 flex h-screen w-[220px] flex-col border-r border-foreground/5 bg-card/95 backdrop-blur-xl lg:hidden"
            >
              {sidebarBody(() => setMobileOpen(false))}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
