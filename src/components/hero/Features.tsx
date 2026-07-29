import { motion } from "framer-motion";
import { SectionEyebrow } from "./SectionEyebrow";
import { Reveal, StaggerGroup, itemVariants } from "./Reveal";

const features = [
  {
    title: "Brands worth pitching",
    body: "Brands across beauty, food, fashion, gaming, wellness, home, and more ranked by fit for your niche, audience, and content. Every match shows the reasoning and next step.",
  },
  {
    title: "Clear scopes, not vague collabs",
    body: "See the deliverables, estimated pay, timing, and usage-rights questions before you spend time pitching. Estimates are labeled when they are not backed by a confirmed offer.",
  },
  {
    title: "One internal MatchAI Inbox",
    body: "Keep each pitch, reply, draft, attachment, and negotiation in a single thread without connecting a personal mailbox. Provider-backed sending and synchronization stay honest until an external transport is selected.",
  },
  {
    title: "Negotiation and deal tracking",
    body: "Your agent helps counter low offers using your reach, deliverables, and usage rights. Any creator-brand payment status is creator-reported and handled outside MatchAI.",
  },
];

export function Features() {
  return (
    <section
      id="features"
      className="relative mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20 lg:py-24 scroll-mt-24"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,oklch(0.45_0.18_295/0.05),transparent_70%)]" />
      <Reveal className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <SectionEyebrow>WHAT YOUR AGENT HANDLES</SectionEyebrow>
          <h2 className="mt-6 text-3xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            The work of a brand manager. Without the agency overhead.
          </h2>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          Four jobs running quietly in the background — all from one chat.
        </p>
      </Reveal>

      <StaggerGroup className="mt-12 grid gap-4 sm:grid-cols-2">
        {features.map((f) => (
          <motion.div
            key={f.title}
            variants={itemVariants}
            className="glass glass-hover group relative rounded-2xl p-6"
          >
            <h3 className="text-base font-semibold text-foreground">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
          </motion.div>
        ))}
      </StaggerGroup>
    </section>
  );
}
