import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";

type Props = {
  label: string;
  value: string | number | ReactNode;
  hint?: string;
  className?: string;
  /** Set true on the hero/featured card to play a one-shot sheen on mount. */
  featured?: boolean;
};

export function StatCard({ label, value, hint, className, featured }: Props) {
  const reduce = useReducedMotion();

  // If value is a plain number, animate it from 0. If it's a string starting
  // with "$" or ending with "%"/"x", parse and animate the numeric portion.
  const rendered = renderAnimatedValue(value);

  return (
    <motion.div
      whileHover={
        reduce
          ? undefined
          : {
              y: -3,
              transition: { duration: 0.2, ease: "easeOut" },
            }
      }
      className={cn(
        "group relative rounded-3xl border border-foreground/[0.06] bg-foreground/[0.03] p-6 backdrop-blur-xl transition-[border-color,box-shadow] duration-200 ease-out hover:border-primary/20 hover:shadow-[0_8px_24px_-8px_oklch(0_0_0/0.22)]",
        featured && "card-sheen",
        className,
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
        {rendered}
      </p>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </motion.div>
  );
}

function renderAnimatedValue(value: string | number | ReactNode): ReactNode {
  if (typeof value === "number") {
    return <AnimatedNumber value={value} />;
  }
  if (typeof value === "string") {
    // $1,234 or $1,234.56
    const money = value.match(/^(\$)([\d,]+(?:\.\d+)?)(.*)$/);
    if (money) {
      const n = Number(money[2].replace(/,/g, ""));
      if (Number.isFinite(n)) {
        return (
          <>
            <AnimatedNumber
              value={n}
              prefix="$"
              format={{ maximumFractionDigits: 0 }}
            />
            {money[3]}
          </>
        );
      }
    }
    // 94% or 4.6x
    const trail = value.match(/^([\d,.]+)([%x×])$/);
    if (trail) {
      const n = Number(trail[1].replace(/,/g, ""));
      if (Number.isFinite(n)) {
        return (
          <AnimatedNumber
            value={n}
            suffix={trail[2]}
            format={{ maximumFractionDigits: trail[1].includes(".") ? 1 : 0 }}
          />
        );
      }
    }
    // plain integer
    const intMatch = value.match(/^[\d,]+$/);
    if (intMatch) {
      const n = Number(value.replace(/,/g, ""));
      if (Number.isFinite(n)) return <AnimatedNumber value={n} />;
    }
  }
  return value;
}

export function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}
