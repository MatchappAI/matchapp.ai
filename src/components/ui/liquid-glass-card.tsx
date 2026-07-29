import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * LiquidGlassCard — refined, production-grade glassmorphism surface.
 *
 * Designed for selective use on premium surfaces: hero feature cards,
 * AI insights panels, highlighted CTAs, analytics summaries.
 *
 * Restraint over spectacle:
 *   - soft translucency, not heavy blur
 *   - faint edge highlight + layered shadow depth
 *   - subtle hover lift only; no drag, no bounce, no displacement filter
 *   - text rendered above all filter layers so readability is preserved
 */
export interface LiquidGlassCardProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Tone of the ambient sheen. Defaults to "primary". */
  tone?: "primary" | "neutral" | "accent";
  /** Enable a soft interactive hover lift. Default true. */
  interactive?: boolean;
  /** Render an inner content padding wrapper. Default true. */
  padded?: boolean;
}

const toneMap: Record<NonNullable<LiquidGlassCardProps["tone"]>, string> = {
  primary:
    "before:bg-[radial-gradient(120%_80%_at_0%_0%,oklch(0.65_0.2_295/0.18),transparent_55%),radial-gradient(120%_80%_at_100%_100%,oklch(0.7_0.18_270/0.12),transparent_60%)]",
  accent:
    "before:bg-[radial-gradient(120%_80%_at_0%_0%,oklch(0.7_0.2_320/0.16),transparent_55%),radial-gradient(120%_80%_at_100%_100%,oklch(0.65_0.18_260/0.12),transparent_60%)]",
  neutral:
    "before:bg-[radial-gradient(120%_80%_at_0%_0%,oklch(0.95_0.01_280/0.08),transparent_60%)]",
};

export const LiquidGlassCard = React.forwardRef<
  HTMLDivElement,
  LiquidGlassCardProps
>(function LiquidGlassCard(
  {
    tone = "primary",
    interactive = true,
    padded = true,
    className,
    children,
    ...props
  },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        // base surface
        "relative isolate overflow-hidden rounded-2xl",
        "bg-foreground/[0.035] backdrop-blur-xl backdrop-saturate-150",
        // crisp hairline border (top-lit)
        "border border-foreground/[0.07]",
        // layered shadow depth
        "shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset,0_20px_60px_-20px_rgba(0,0,0,0.7),0_8px_24px_-12px_rgba(0,0,0,0.5)]",
        // ambient sheen layer (::before)
        "before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:opacity-80",
        toneMap[tone],
        // faint top edge highlight (::after)
        "after:pointer-events-none after:absolute after:inset-x-0 after:top-0 after:h-px",
        "after:bg-gradient-to-r after:from-transparent after:via-white/25 after:to-transparent",
        // restrained interaction
        interactive &&
          "transition-[transform,box-shadow,border-color] duration-300 ease-out will-change-transform " +
            "hover:-translate-y-0.5 hover:border-foreground/[0.11] " +
            "hover:shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset,0_28px_70px_-20px_rgba(0,0,0,0.75),0_10px_28px_-12px_rgba(0,0,0,0.55)]",
        className,
      )}
      {...props}
    >
      {/* Content sits above all filter layers — text stays crisp. */}
      <div className={cn("relative z-10", padded && "p-6 sm:p-7")}>{children}</div>
    </div>
  );
});

export function LiquidGlassCardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center gap-3", className)}
      {...props}
    />
  );
}

export function LiquidGlassCardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-base font-semibold tracking-tight text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function LiquidGlassCardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "text-sm leading-relaxed text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
