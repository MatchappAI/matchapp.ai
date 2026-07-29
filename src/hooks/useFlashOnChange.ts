import { useEffect, useRef, useState } from "react";

/**
 * Flashes a field whenever the tracked value changes after first render.
 * Spread the returned props onto an element to play the purple highlight
 * animation defined in styles.css (`[data-just-updated="true"]`).
 *
 * Use on inputs/displays that may be filled-in by the agent — e.g. pricing
 * floor/target updated via a chat action, or profile fields set by onboarding.
 */
export function useFlashOnChange(value: unknown, durationMs = 1600) {
  const prev = useRef<unknown>(value);
  const firstRender = useRef(true);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      prev.current = value;
      return;
    }
    const a = String(value ?? "");
    const b = String(prev.current ?? "");
    if (a === b) return;
    prev.current = value;
    setActive(true);
    const t = setTimeout(() => setActive(false), durationMs);
    return () => clearTimeout(t);
  }, [value, durationMs]);

  return active ? { "data-just-updated": "true" as const } : {};
}
