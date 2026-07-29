import { motion } from "framer-motion";
import { Wand2, TrendingUp, Target, ArrowUpRight } from "lucide-react";
import {
  LiquidGlassCard,
  LiquidGlassCardDescription,
  LiquidGlassCardHeader,
  LiquidGlassCardTitle,
} from "@/components/ui/liquid-glass-card";
import { SectionEyebrow } from "./SectionEyebrow";
import { Reveal, StaggerGroup, itemVariants } from "./Reveal";
import { IconTile, type IconTone } from "./IconTile";

const insights: { icon: typeof Target; title: string; metric: string; label: string; body: string; tone: IconTone }[] = [
  {
    icon: Target,
    tone: "violet",
    title: "Match #1",
    metric: "92% fit",
    label: "Lumen Activewear · Austin",
    body: "Pitch this one. Your last 6 Reels overlap with their Q3 launch and they paid two creators your size in the last 30 days.",
  },
  {
    icon: TrendingUp,
    tone: "emerald",
    title: "Suggested rate",
    metric: "$650–$900",
    label: "1 Reel + 3 Stories · 30-day usage",
    body: "Quote $750. Brands your size in this niche paid a median of $720 last month. Don't go below $500.",
  },
  {
    icon: Wand2,
    tone: "fuchsia",
    title: "Draft ready",
    metric: "78 words",
    label: "Subject: love what you're doing with Lumen",
    body: "Reads like you wrote it on your phone. Hit approve to send, or tell me \"make it more casual\".",
  },
];

export function AiInsights() {
  return (
    <section className="relative mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-16 lg:py-20">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,oklch(0.45_0.18_295/0.05),transparent_70%)]" />

      <Reveal className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <SectionEyebrow>A PEEK INSIDE</SectionEyebrow>
          <h2 className="mt-6 text-3xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Open the app. This is what's waiting.
          </h2>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          Specific brand. Specific rate. Specific pitch. No dashboards to decode.
        </p>
      </Reveal>

      <StaggerGroup className="mt-14 grid gap-5 md:grid-cols-3">
        {insights.map((i) => (
            <motion.div key={i.title} variants={itemVariants}>
              <LiquidGlassCard tone="primary" className="group h-full">
                <LiquidGlassCardHeader>
                  <IconTile icon={i.icon} tone={i.tone} size="sm" />
                  <LiquidGlassCardTitle>{i.title}</LiquidGlassCardTitle>
                </LiquidGlassCardHeader>

                <div className="mt-6 flex items-baseline gap-2">
                  <span className="font-display text-3xl font-semibold tracking-tight text-foreground">
                    {i.metric}
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-primary/70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
                </div>
                <p className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground/80">
                  {i.label}
                </p>

                <LiquidGlassCardDescription className="mt-5">
                  {i.body}
                </LiquidGlassCardDescription>
              </LiquidGlassCard>
            </motion.div>
        ))}
      </StaggerGroup>
    </section>
  );
}
