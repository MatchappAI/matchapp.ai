import NumberFlow, { type Format } from "@number-flow/react";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

type Props = {
  value: number;
  prefix?: string;
  suffix?: string;
  format?: Format;
  className?: string;
};

/**
 * Animates from 0 → value when scrolled into view. Format-aware so
 * "$12,400" stays "$12,400" — only the digits animate.
 */
export function AnimatedNumber({ value, prefix, suffix, format, className }: Props) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (reduce) {
      setActive(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setActive(true);
            obs.disconnect();
            break;
          }
        }
      },
      { threshold: 0.3 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [reduce]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      <NumberFlow
        value={active ? value : 0}
        format={format}
        transformTiming={{ duration: reduce ? 0 : 1200, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}
        spinTiming={{ duration: reduce ? 0 : 1200, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}
        opacityTiming={{ duration: reduce ? 0 : 400, easing: "ease-out" }}
      />
      {suffix}
    </span>
  );
}
