import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Bell, Search } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  searchAll,
} from "@/lib/dashboard.functions";
import { cn } from "@/lib/utils";

type Notif = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  action_route: string | null;
  read: boolean;
  created_at: string;
};

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function DashboardTopBar({ avatarSeed, avatarUrl }: { avatarSeed: string; avatarUrl?: string | null }) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const list = useServerFn(listNotifications);
  const markAll = useServerFn(markAllNotificationsRead);
  const markOne = useServerFn(markNotificationRead);
  const search = useServerFn(searchAll);

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => list({ data: {} as never }),
    refetchOnWindowFocus: true,
  });

  // Realtime subscription: refetch on any notification change for current user
  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user || cancelled) return;
      // Set auth for realtime so RLS on realtime.messages can authorize the topic
      await supabase.realtime.setAuth();
      channel = supabase
        .channel(`notifications:${u.user.id}`, { config: { private: true } })
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${u.user.id}` },
          () => qc.invalidateQueries({ queryKey: ["notifications"] }),
        )
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [qc]);

  const notifications: Notif[] = data?.notifications ?? [];
  const unread = notifications.filter((n) => !n.read).length;
  const reduce = useReducedMotion();

  // Trigger bell swing whenever unread count rises (new notification arrives).
  const prevUnreadRef = useRef(unread);
  const [bellSwingKey, setBellSwingKey] = useState(0);
  useEffect(() => {
    if (unread > prevUnreadRef.current) setBellSwingKey((k) => k + 1);
    prevUnreadRef.current = unread;
  }, [unread]);

  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);


  const markAllMut = useMutation({
    mutationFn: () => markAll({ data: {} as never }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not mark all read"),
  });

  const markOneMut = useMutation({
    mutationFn: (id: string) => markOne({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update notification"),
  });


  // Search state
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data: searchData } = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => search({ data: { q: debounced } }),
    enabled: debounced.length > 0,
  });

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const hasResults = useMemo(
    () =>
      (searchData?.brands.length ?? 0) +
        (searchData?.deals.length ?? 0) +
        (searchData?.outreach.length ?? 0) >
      0,
    [searchData],
  );

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-foreground/5 bg-background/60 py-3 pl-16 pr-4 backdrop-blur-xl sm:gap-4 lg:pl-6 lg:pr-8">
      {/* Search */}
      <div ref={searchRef} className="relative flex-1 max-w-2xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          placeholder="Search brands, deals, payments..."
          className="w-full rounded-xl border border-foreground/5 bg-foreground/[0.03] py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
        {searchOpen && debounced.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[420px] overflow-y-auto rounded-2xl border border-foreground/10 bg-card/95 p-2 shadow-2xl backdrop-blur-xl">
            {!hasResults ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No results for "{debounced}"
              </div>
            ) : (
              <>
                {searchData!.brands.length > 0 && (
                  <Section title="Brand Matches">
                    {searchData!.brands.map((b) => (
                      <ResultRow
                        key={b.id}
                        label={b.brand_name}
                        meta={b.status}
                        onClick={() => {
                          setSearchOpen(false);
                          setQ("");
                          navigate({ to: "/dashboard/brands" });
                        }}
                      />
                    ))}
                  </Section>
                )}
                {searchData!.deals.length > 0 && (
                  <Section title="Deals">
                    {searchData!.deals.map((d) => (
                      <ResultRow
                        key={d.id}
                        label={d.brand_name}
                        meta={d.status}
                        onClick={() => {
                          setSearchOpen(false);
                          setQ("");
                          navigate({ to: "/dashboard/deals" });
                        }}
                      />
                    ))}
                  </Section>
                )}
                {searchData!.outreach.length > 0 && (
                  <Section title="Outreach">
                    {searchData!.outreach.map((o) => (
                      <ResultRow
                        key={o.id}
                        label={o.subject}
                        meta={o.replied ? "replied" : o.sent ? "sent" : "draft"}
                        onClick={() => {
                          setSearchOpen(false);
                          setQ("");
                          navigate({ to: "/dashboard/approvals" });
                        }}
                      />
                    ))}
                  </Section>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Right cluster */}
      <div className="ml-auto flex items-center gap-3">


        {/* Bell */}
        <div ref={bellRef} className="relative">
          <motion.button
            type="button"
            onClick={() => setBellOpen((o) => !o)}
            whileHover={reduce ? undefined : { scale: 1.06 }}
            whileTap={reduce ? undefined : { scale: 0.92 }}
            transition={{ type: "spring", stiffness: 500, damping: 22 }}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-foreground/5 bg-foreground/[0.03] text-foreground transition-colors hover:bg-foreground/10"
            aria-label="Notifications"
          >
            <motion.span
              key={bellSwingKey}
              animate={
                reduce
                  ? undefined
                  : bellSwingKey > 0
                    ? { rotate: [0, 15, -12, 8, -5, 0] }
                    : undefined
              }
              transition={{ duration: 0.6, ease: "easeInOut" }}
              style={{ display: "inline-flex", transformOrigin: "50% 10%" }}
            >
              <Bell className="h-4 w-4" />
            </motion.span>
            <AnimatePresence>
              {unread > 0 && (
                <motion.span
                  key="badge"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 20 }}
                  className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground"
                >
                  {unread > 9 ? (
                    "9+"
                  ) : (
                    <AnimatedNumber value={unread} />
                  )}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          <AnimatePresence>
            {bellOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } }}
                exit={{ opacity: 0, scale: 0.96, y: -4, transition: { duration: 0.14 } }}
                style={{ transformOrigin: "top right" }}
                className="absolute right-0 top-full z-50 mt-2 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-foreground/10 bg-card/95 shadow-2xl backdrop-blur-xl"
              >
                <div className="flex items-center justify-between border-b border-foreground/5 px-4 py-3">
                  <span className="text-sm font-semibold text-foreground">Notifications</span>
                  <button
                    type="button"
                    onClick={() => markAllMut.mutate()}
                    disabled={unread === 0 || markAllMut.isPending}
                    className="text-xs font-medium text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
                  >
                    Mark all read
                  </button>
                </div>
                <div className="max-h-[420px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                      No notifications yet.
                    </div>
                  ) : (
                    <AnimatePresence initial={false}>
                      {notifications.map((n) => (
                        <motion.button
                          key={n.id}
                          layout
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto", transition: { height: { duration: 0.28, ease: [0.16, 1, 0.3, 1] }, opacity: { duration: 0.2, delay: 0.05 } } }}
                          exit={{ opacity: 0, height: 0, transition: { duration: 0.18 } }}
                          type="button"
                          onClick={() => {
                            markOneMut.mutate(n.id);
                            setBellOpen(false);
                            if (n.action_route) navigate({ to: n.action_route as never });
                          }}
                          className={cn(
                            "block w-full overflow-hidden border-b border-foreground/5 px-4 py-3 text-left transition-colors hover:bg-foreground/[0.04]",
                            !n.read && "bg-primary/[0.06]",
                          )}
                        >
                          <p className="text-sm font-semibold text-foreground">{n.title}</p>
                          {n.description && (
                            <p className="mt-1 text-xs text-muted-foreground">{n.description}</p>
                          )}
                          <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                            {timeAgo(n.created_at)}
                          </p>
                        </motion.button>
                      ))}
                    </AnimatePresence>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>





        {/* Avatar */}
        <Link
          to="/dashboard/settings"
          className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-primary hover:bg-primary/90 transition-colors text-sm font-semibold text-primary-foreground"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={avatarSeed} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            avatarSeed.slice(0, 1).toUpperCase()
          )}
        </Link>
      </div>
    </header>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function ResultRow({
  label,
  meta,
  onClick,
}: {
  label: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-foreground/[0.05]"
    >
      <span className="break-words text-sm text-foreground">{label}</span>
      <span className="ml-3 shrink-0 rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {meta}
      </span>
    </button>
  );
}

