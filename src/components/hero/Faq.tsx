import { motion } from "framer-motion";
import { SectionEyebrow } from "./SectionEyebrow";
import { Reveal, StaggerGroup, itemVariants } from "./Reveal";

const faqs = [
  {
    q: "What does MatchAI actually do?",
    a: "Helps you organize brands and contacts, drafts outreach in your voice, keeps communications in one Inbox, supports negotiation, and tracks creator-reported deal progress. Sending becomes available through your internal MatchAI email when an email API provider is configured.",
  },
  {
    q: "Do I need to connect Gmail or an email account?",
    a: "No. You use an internal MatchAI email identity and Inbox. The external delivery and synchronization API is still being selected, so MatchAI will never claim a message was sent before that provider is configured.",
  },
  {
    q: "Will this work with a small following?",
    a: "Yes. Brands care more about niche fit, engagement, and locality than follower count. Smaller, local, and niche brands are usually the fastest first wins — MatchAI ranks matches by fastest-to-cash.",
  },
  {
    q: "Is this just AI templates?",
    a: 'No. Every pitch is rebuilt per brand from your niche, audience, last 30 posts, tone, and the brand\'s recent moves. Tell it "too formal" or "that\'s not me" and it adjusts.',
  },
  {
    q: "What if I don't know what to charge?",
    a: "Your agent recommends a fair rate based on your reach, deliverables, usage rights, and brand size — and pushes back on lowball offers.",
  },
  {
    q: "Is the Free plan a trick?",
    a: "No card is required for the free experience. Paid MatchAI plans are subscriptions only; MatchAI never takes a percentage of creator-brand deals.",
  },
  {
    q: "How do I get paid?",
    a: "The brand pays you directly outside MatchAI using terms and a payment method you agree on together. MatchAI does not hold funds, operate a wallet, or process creator payouts.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Monthly MatchAI subscriptions can be cancelled from settings. Cancelling MatchAI does not alter the independent terms of your creator-brand deals.",
  },
];

export function Faq() {
  return (
    <section
      id="faq"
      className="relative mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20 lg:py-24 scroll-mt-24"
    >
      <Reveal className="max-w-2xl">
        <SectionEyebrow>STILL HAVE QUESTIONS?</SectionEyebrow>
        <h2 className="mt-6 text-3xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          Everything creators ask before signing up.
        </h2>
      </Reveal>

      <StaggerGroup className="mt-8 grid gap-4 lg:grid-cols-2" stagger={0.05}>
        {faqs.map((f) => (
          <motion.div
            key={f.q}
            variants={itemVariants}
            className="spotlight glass glass-hover rounded-2xl p-6"
          >
            <h3 className="text-base font-semibold text-foreground">{f.q}</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
          </motion.div>
        ))}
      </StaggerGroup>
    </section>
  );
}
