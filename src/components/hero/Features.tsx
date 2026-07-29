import { motion } from "framer-motion";
import { SectionEyebrow } from "./SectionEyebrow";
import { Reveal, StaggerGroup, itemVariants } from "./Reveal";

const features = [
  { title: "Brands worth pitching", body: "Real beauty, skincare, haircare, fashion and accessories companies actively paying creators — ranked by fit for your niche, aesthetic, audience, and city. Every match shows the reasoning." },
  { title: "Specific paid offers, not vague collabs", body: "Concrete packages priced for your size — e.g. \"3 skincare UGC videos + 60d paid usage for $1,200\" or \"1 TikTok + 1 Reel + 3 Story frames for a launch, $950\" — shaped by your rates and the brand's category." },
  { title: "One inbox, one thread per brand", body: "Every pitch, reply, counter, contract, and payout in a single thread — no Gmail to connect, no lost DMs. Unlimited outbound on Free, unlimited inbound on paid plans." },
  { title: "Negotiation & protected payment", body: "Your agent counters lowballs with a fair rate based on your reach, deliverables and usage rights — then tracks payment from agreement to payout in your bank." },
];

export function Features() {
  return (
    <section id="features" className="relative mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20 lg:py-24 scroll-mt-24">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,oklch(0.45_0.18_295/0.05),transparent_70%)]" />
      <Reveal className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <SectionEyebrow>WHAT YOUR AGENT HANDLES</SectionEyebrow>
          <h2 className="mt-6 text-3xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            The work of a brand manager. Without the $2K monthly retainer.
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
