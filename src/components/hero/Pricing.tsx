import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { SectionEyebrow } from "./SectionEyebrow";
import { Reveal, StaggerGroup, itemVariants } from "./Reveal";
import { useIsSignedIn } from "@/hooks/useIsSignedIn";
import { createCheckoutSession } from "@/lib/payments.functions";
import { MONETIZATION_COPY, FAIR_DEAL_GUARANTEE } from "@/lib/pricing-config";

type PaidSlug = "starter" | "growth" | "pro";
type PlanSlug = "free" | PaidSlug;

type Plan = {
  name: string;
  slug: PlanSlug;
  price: string;
  priceNote: string;
  pitches: string;
  matches: string;
  tagline: string;
  features: string[];
  cta: string;
  featured?: boolean;
};

const plans: Plan[] = [
  {
    name: "Free",
    slug: "free",
    price: "$0",
    priceNote: "/ mo",
    pitches: "100 personalized pitches / mo",
    matches: "Limited inbound threads (free)",
    tagline: "Start with no upfront cost. Upgrade when you want more inbox capacity and support.",
    features: [
      "AI brand matching + personalized outreach",
      "Automated follow-ups",
      "Basic deal tracking",
      "Human support from the MatchAI team",
      "No credit card required",
    ],
    cta: "Start Free",
  },
  {
    name: "Starter",
    slug: "starter",
    price: "$49",
    priceNote: "/ mo",
    pitches: "100 personalized pitches / mo",
    matches: "Unlimited inbound + outbound",
    tagline: "For creators closing their first paid deals.",
    features: [
      "Everything in Free",
      "AI negotiation support",
      "Creator pricing guidance",
      "Advanced deal pipeline",
    ],
    cta: "Choose Starter",
  },
  {
    name: "Growth",
    slug: "growth",
    price: "$99",
    priceNote: "/ mo",
    pitches: "250 personalized pitches / mo",
    matches: "Unlimited inbound + priority matching",
    tagline: "For active creators scaling volume and support.",
    features: [
      "Everything in Starter",
      "Advanced follow-up sequences",
      "Campaign & earnings analytics",
      "Faster support",
    ],
    cta: "Choose Growth",
    featured: true,
  },
  {
    name: "Pro",
    slug: "pro",
    price: "$199",
    priceNote: "/ mo",
    pitches: "500 personalized pitches / mo",
    matches: "Unlimited inbound + highest-priority matching",
    tagline: "For high-volume creators who keep 100% of every deal.",
    features: [
      "Everything in Growth",
      "Advanced AI negotiation",
      "Dedicated success support",
      "Priority campaign & deal assistance",
    ],
    cta: "Choose Pro",
  },
];

export function Pricing() {
  const signedIn = useIsSignedIn();
  const navigate = useNavigate();
  const checkout = useServerFn(createCheckoutSession);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleSelectPlan = async (slug: PlanSlug) => {
    if (slug === "free") {
      navigate({ to: "/auth", search: { tab: "signup" } });
      return;
    }
    if (!signedIn) {
      navigate({ to: "/auth", search: { tab: "signup", plan: slug } });
      return;
    }
    try {
      setLoadingPlan(slug);
      const { url } = await checkout({ data: { plan: slug, origin: window.location.origin } });
      window.location.href = url;
    } catch (err) {
      console.error("Checkout failed", err);
      setLoadingPlan(null);
      toast.error("Could not start checkout. Please try again.");
    }
  };

  return (
    <section
      id="pricing"
      className="relative mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20 lg:py-24 scroll-mt-24"
    >
      <Reveal className="max-w-2xl">
        <SectionEyebrow>PRICING</SectionEyebrow>
        <h2 className="mt-6 text-3xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          {MONETIZATION_COPY.headline}
        </h2>
        <p className="mt-5 text-[15.5px] leading-[1.7] text-muted-foreground">
          {MONETIZATION_COPY.sub}
        </p>
        <p className="mt-4 text-[13.5px] font-medium text-foreground/80">
          {MONETIZATION_COPY.compareLine}
        </p>
      </Reveal>

      <StaggerGroup className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.08}>
        {plans.map((p) => (
          <motion.div
            key={p.name}
            variants={itemVariants}
            className={`glass glass-hover relative flex flex-col rounded-3xl p-6 ${p.featured ? "ring-1 ring-foreground/15 shadow-[0_30px_80px_-30px_oklch(0_0_0/0.18)]" : ""}`}
          >
            {p.featured && (
              <span className="absolute -top-3 left-6 rounded-full bg-foreground px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-background shadow-lg shadow-black/10">
                Most popular
              </span>
            )}
            <h3 className="text-lg font-semibold text-foreground">{p.name}</h3>
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="text-5xl font-bold tracking-tight text-foreground">{p.price}</span>
              <span className="text-sm text-muted-foreground">{p.priceNote}</span>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">{p.tagline}</p>

            <div className="mt-5 space-y-1.5 text-[13px] text-foreground/90">
              <p>{p.pitches}</p>
              <p className="text-muted-foreground">{p.matches}</p>
            </div>

            <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
              {p.features.map((f) => (
                <li key={f} className="leading-snug">
                  <span className="mr-2 text-muted-foreground">·</span>
                  {f}
                </li>
              ))}
            </ul>

            <button
              type="button"
              disabled={loadingPlan === p.slug}
              onClick={() => handleSelectPlan(p.slug)}
              className={`btn-sheen mt-auto block w-full rounded-xl px-5 py-3.5 text-center text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed ${
                p.featured
                  ? "bg-foreground text-background shadow-[0_10px_40px_-10px_oklch(0_0_0/0.35)] ring-1 ring-foreground/20"
                  : "border border-border bg-card-inner/60 text-foreground backdrop-blur hover:bg-card-inner"
              }`}
              style={{ marginTop: "1.75rem" }}
            >
              {loadingPlan === p.slug ? `Opening ${p.name} checkout…` : p.cta}
            </button>
          </motion.div>
        ))}
      </StaggerGroup>

      {/* Fair Deal Guarantee */}
      <div className="mt-12 rounded-3xl border border-foreground/[0.08] bg-foreground/[0.02] p-6 sm:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/70">
          The Fair Deal Guarantee
        </p>
        <h3 className="mt-2 text-xl font-bold text-foreground sm:text-2xl">
          Four promises we make on every subscription.
        </h3>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {FAIR_DEAL_GUARANTEE.items.map((it) => (
            <div
              key={it.label}
              className="rounded-2xl border border-foreground/[0.06] bg-background/60 p-4"
            >
              <p className="text-sm font-semibold text-foreground">{it.label}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{it.body}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        MatchAI subscriptions are billed separately from any creator-brand payment handled outside
        the product. Stripe payment-processing fees (~2.9% + $0.30) are billed by Stripe. If a
        selected deal includes a separate MatchAI commission, that is agreed up front and tracked
        outside the payment flow. Cancel anytime.
      </p>
    </section>
  );
}
