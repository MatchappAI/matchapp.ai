import { motion } from "framer-motion";
import { BadgeCheck, MessageSquareOff, PenSquare } from "lucide-react";
import { SectionEyebrow } from "./SectionEyebrow";
import { Reveal, StaggerGroup, itemVariants } from "./Reveal";
import { IconTile, type IconTone } from "./IconTile";

const principles: { icon: typeof BadgeCheck; title: string; body: string; tone: IconTone }[] = [
  { icon: BadgeCheck, tone: "emerald", title: "Real brands. Real contacts.", body: "Every match is a verified company that pays creators, with the right person already pulled. No scraped junk, no dead leads." },
  { icon: MessageSquareOff, tone: "sky", title: "No fake wins, no hype", body: "No fabricated testimonials, no staged deal screenshots. When you win, we celebrate it — only with your permission." },
  { icon: PenSquare, tone: "fuchsia", title: "Nothing sends without you", body: "I draft. You approve. You have the last word on every message that goes out under your name — forever, even on autopilot." },
];

export function PlanDetail() {
  return (
    <section className="relative mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
      <Reveal className="max-w-2xl">
        <SectionEyebrow>WHY CREATORS TRUST US</SectionEyebrow>
        <h2 className="mt-6 text-3xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          An agent that works for you. Never against your name.
        </h2>
      </Reveal>

      <StaggerGroup className="mt-14 grid gap-4 lg:grid-cols-3">
        {principles.map((p) => (
          <motion.div key={p.title} variants={itemVariants} className="spotlight glass glass-hover group relative rounded-2xl p-7">
            <IconTile icon={p.icon} tone={p.tone} />
            <h3 className="mt-5 text-lg font-semibold text-foreground">{p.title}</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
          </motion.div>
        ))}
      </StaggerGroup>
    </section>
  );
}
