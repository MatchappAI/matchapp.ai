import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useRouterState } from "@tanstack/react-router";
import { logUsageEvent } from "@/lib/insights.functions";

/** Auto-track route views. Mount once at the dashboard layout. */
export function usePageViewTracking() {
  const log = useServerFn(logUsageEvent);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (last.current === pathname) return;
    last.current = pathname;
    log({ data: { event: "page_view", route: pathname } }).catch(() => {});
  }, [pathname, log]);
}

/** Fire-and-forget event tracker for buttons/actions. */
export function useTrackEvent() {
  const log = useServerFn(logUsageEvent);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (event: string, properties?: Record<string, unknown>) => {
    log({ data: { event, route: pathname, properties } }).catch(() => {});
  };
}
