import { motion } from "framer-motion";
import { SectionEyebrow } from "./SectionEyebrow";
import { Reveal, StaggerGroup, itemVariants } from "./Reveal";

const faqs = [
  { q: "What does MatchAI actually do?", a: "Finds brands worth pitching, writes each email in your voice, sends it from our verified domain, follows up automatically, negotiates the rate when replies come in, and tracks payment from agreement through to your bank." },
  { q: "Do I need to connect Gmail or an email account?", a: "No. MatchAI sends from its own verified domain (outreach@notify.www.matchapp.ai, shown as \"You via MatchAI\"). Brand replies route straight back into your MatchAI inbox — one thread per brand." },
  { q: "Will this work with a small following?", a: "Yes. Brands care more about niche fit, engagement, and locality than follower count. Smaller, local, and niche brands are usually the fastest first wins — MatchAI ranks matches by fastest-to-cash." },
  { q: "Is this just AI templates?", a: "No. Every pitch is rebuilt per brand from your niche, audience, last 30 posts, tone, and the brand's recent moves. Tell it \"too formal\" or \"that's not me\" and it adjusts." },
  { q: "What if I don't know what to charge?", a: "Your agent recommends a fair rate based on your reach, deliverables, usage rights, and brand size — and pushes back on lowball offers." },
  { q: "Is the Free plan a trick?", a: "No. No card required. Run unlimited outbound pitching, follow-ups, and negotiation for free. Free includes a limited number of active inbound brand threads — paid plans unlock unlimited inbound. When a MatchAI-sourced deal is completed and paid, choose a plan or stay Free and pay a 20% success fee (capped at $99 per deal)." },
  { q: "How do I get paid?", a: "Link your bank once via Stripe. Once a deal is signed and delivered, funds are released to your linked account. Repeat deals with the same brand are always 0% fee." },
  { q: "Can I cancel anytime?", a: "Yes. Monthly plans cancel from settings. Fee terms on any deal already in progress stay locked to what was agreed when the brand replied." },
];

export function Faq() {
  return (
    <section id="faq" className="relative mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20 lg:py-24 scroll-mt-24">
      <Reveal className="max-w-2xl">
        <SectionEyebrow>STILL HAVE QUESTIONS?</SectionEyebrow>
        <h2 className="mt-6 text-3xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          Everything creators ask before signing up.
        </h2>
      </Reveal>

      <StaggerGroup className="mt-8 grid gap-4 lg:grid-cols-2" stagger={0.05}>
        {faqs.map((f) => (
          <motion.div key={f.q} variants={itemVariants} className="spotlight glass glass-hover rounded-2xl p-6">
            <h3 className="text-base font-semibold text-foreground">{f.q}</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
          </motion.div>
        ))}
      </StaggerGroup>
    </section>
  );
}
