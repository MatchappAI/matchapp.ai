import { motion } from "framer-motion";
import { Search, DollarSign, PenLine, GhostIcon, Clock, Workflow } from "lucide-react";
import { SectionEyebrow } from "./SectionEyebrow";
import { Reveal, StaggerGroup, itemVariants } from "./Reveal";
import { IconTile, type IconTone } from "./IconTile";

const struggles: { icon: typeof Search; title: string; body: string; tone: IconTone }[] = [
  { icon: Search, tone: "sky", title: "I don't know who to pitch.", body: "You shouldn't need an agent to know which brands would actually pay you." },
  { icon: DollarSign, tone: "emerald", title: "I don't know what to charge.", body: "Quote low, feel cheap. Quote high, get ghosted. Guessing every time is exhausting." },
  { icon: PenLine, tone: "fuchsia", title: "Cold DMs feel awkward.", body: "Blank message. Five rewrites. Close the tab. Nothing ever sends." },
  { icon: GhostIcon, tone: "rose", title: "Sent one. Got ghosted.", body: "No follow-up, no deal. It dies in your sent folder." },
  { icon: Clock, tone: "amber", title: "Pitching eats my week.", body: "Hours on research and follow-ups that should go into your content." },
  { icon: Workflow, tone: "indigo", title: "Every deal starts from zero.", body: "No memory, no system. You're rebuilding the wheel every single time." },
];

export function Roi() {
  return (
    <section className="relative mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
      <Reveal className="max-w-2xl">
        <SectionEyebrow>SOUND FAMILIAR?</SectionEyebrow>
        <h2 className="mt-6 text-3xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          You're great at content. Brand deals shouldn't be a second job.
        </h2>
        <p className="mt-5 text-[15.5px] leading-[1.7] text-muted-foreground">
          Most creators lose more deals to the awkward parts — research, pitching, follow-up, pricing — than to anything else. That's the part MatchAI takes off your plate.
        </p>
      </Reveal>

      <StaggerGroup className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {struggles.map((s) => (
          <motion.div
            key={s.title}
            variants={itemVariants}
            className="spotlight glass glass-hover group relative rounded-2xl p-6"
          >
            <IconTile icon={s.icon} tone={s.tone} />
            <h3 className="mt-5 text-base font-semibold text-foreground transition-colors group-hover:text-primary">
              {s.title}
            </h3>
            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          </motion.div>
        ))}
      </StaggerGroup>
    </section>
  );
}
