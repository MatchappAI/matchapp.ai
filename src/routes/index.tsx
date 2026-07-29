import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/components/hero/Hero";
import { BrandLogoStrip } from "@/components/hero/BrandLogoStrip";
import { ProductShowcase } from "@/components/hero/ProductShowcase";
import { HowItWorks } from "@/components/ui/how-it-works";
import { Features } from "@/components/hero/Features";
import { InboxConnect } from "@/components/hero/InboxConnect";
import { Pricing } from "@/components/hero/Pricing";
import { Faq } from "@/components/hero/Faq";
import { FinalCta } from "@/components/hero/FinalCta";
import { SiteFooter } from "@/components/hero/SiteFooter";
import { SmoothScroll } from "@/components/hero/SmoothScroll";
import { GradientDivider } from "@/components/hero/GradientDivider";
import { TrustBar } from "@/components/hero/TrustBar";
import { PersonalizationSignals } from "@/components/hero/PersonalizationSignals";
import { HeroCallout } from "@/components/hero/HeroCallout";
import { OutcomePricingCallout } from "@/components/hero/OutcomePricingCallout";
import { DealChecker } from "@/components/hero/DealChecker";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MatchAI — Your AI brand deals agent in your pocket" },
      {
        name: "description",
        content:
          "Get paid brand deals without the pitching, chasing, or bad offers. MatchAI helps UGC creators and micro-influencers find opportunities, draft outreach, track applications, and price offers.",
      },
      { property: "og:title", content: "MatchAI — Get paid brand deals without the chasing" },
      {
        property: "og:description",
        content:
          "Find brand-fit opportunities, write creator-approved pitches, track every application, and flag bad offers before you sign.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="grain relative bg-background">
      <SmoothScroll />
      <Hero />
      <HeroCallout />
      <BrandLogoStrip />
      <GradientDivider />
      <ProductShowcase />
      <GradientDivider />
      <HowItWorks />
      <GradientDivider />
      <DealChecker />
      <GradientDivider />
      <PersonalizationSignals />
      <GradientDivider />
      <Features />

      <GradientDivider />
      <InboxConnect />
      <GradientDivider />
      <OutcomePricingCallout />
      <Pricing />
      <GradientDivider />
      <Faq />
      <FinalCta />
      <TrustBar />
      <SiteFooter />
    </div>
  );
}
