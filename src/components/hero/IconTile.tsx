import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type IconTone =
  | "violet"
  | "fuchsia"
  | "sky"
  | "emerald"
  | "amber"
  | "rose"
  | "indigo"
  | "cyan";

// Cohesive palette: each tone shares the same structure (gradient tile, ring,
// inner highlight, soft outer glow) so colorful never reads as mismatched.
const TONES: Record<
  IconTone,
  { from: string; to: string; ring: string; glow: string; text: string }
> = {
  violet:   { from: "from-indigo-500/30",   to: "to-indigo-500/5",   ring: "ring-indigo-400/35",   glow: "shadow-[0_10px_30px_-12px_rgba(99,102,241,0.6)]",    text: "text-indigo-100" },
  fuchsia:  { from: "from-violet-500/30",   to: "to-violet-500/5",   ring: "ring-violet-400/35",   glow: "shadow-[0_8px_24px_-8px_oklch(0_0_0/0.22)]",    text: "text-violet-100" },
  sky:      { from: "from-indigo-400/30",   to: "to-indigo-500/5",   ring: "ring-indigo-300/35",   glow: "shadow-[0_10px_30px_-12px_rgba(123,168,255,0.55)]",  text: "text-[#cfe0ff]" },
  emerald:  { from: "from-indigo-500/30",   to: "to-indigo-500/5",   ring: "ring-indigo-400/35",   glow: "shadow-[0_10px_30px_-12px_rgba(99,102,241,0.55)]",   text: "text-indigo-100" },
  amber:    { from: "from-violet-400/30",   to: "to-violet-500/5",   ring: "ring-violet-300/35",   glow: "shadow-[0_10px_30px_-12px_rgba(167,139,250,0.55)]",  text: "text-violet-100" },
  rose:     { from: "from-violet-500/30",   to: "to-violet-500/5",   ring: "ring-violet-400/35",   glow: "shadow-[0_8px_24px_-8px_oklch(0_0_0/0.22)]",   text: "text-violet-100" },
  indigo:   { from: "from-indigo-500/30",   to: "to-indigo-500/5",   ring: "ring-indigo-400/35",   glow: "shadow-[0_10px_30px_-12px_rgba(99,102,241,0.6)]",    text: "text-indigo-100" },
  cyan:     { from: "from-indigo-400/30",   to: "to-indigo-500/5",   ring: "ring-indigo-300/35",   glow: "shadow-[0_10px_30px_-12px_rgba(123,168,255,0.55)]",  text: "text-[#cfe0ff]" },
};

const SIZES = {
  sm: { tile: "h-9 w-9 rounded-lg", icon: "h-4 w-4" },
  md: { tile: "h-11 w-11 rounded-xl", icon: "h-5 w-5" },
  lg: { tile: "h-12 w-12 rounded-xl", icon: "h-[1.35rem] w-[1.35rem]" },
};

export function IconTile({
  icon: Icon,
  tone = "violet",
  size = "md",
  className,
}: {
  icon: LucideIcon;
  tone?: IconTone;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const t = TONES[tone];
  const s = SIZES[size];

  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center bg-gradient-to-br ring-1 backdrop-blur-sm",
        "before:pointer-events-none before:absolute before:inset-px before:rounded-[inherit] before:bg-gradient-to-b before:from-white/10 before:to-transparent",
        s.tile,
        t.from,
        t.to,
        t.ring,
        t.glow,
        className,
      )}
    >
      <Icon className={cn("relative", s.icon, t.text)} strokeWidth={1.85} aria-hidden />
    </span>
  );
}
