import { Link } from "@tanstack/react-router";
import { Reveal } from "./Reveal";

export function FinalCta() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
      <Reveal>
        <div className="glass relative overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] p-6 sm:p-10 lg:p-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,oklch(0.6_0.06_285/0.06),transparent_60%)]" />
          <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-[oklch(0.7_0.02_260/0.06)] blur-3xl" />
          <div className="relative max-w-2xl">
            <h2 className="text-3xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Land the deal first. Keep payment outside MatchAI.
            </h2>
            <p className="mt-5 text-[15.5px] leading-[1.7] text-muted-foreground">
              Start free. No credit card. Internal creator email is included. MatchAI subscriptions
              cover the product, while creator-brand payment stays external.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/auth"
                className="btn-sheen rounded-xl bg-primary hover:bg-primary/90 transition-colors px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-[0_8px_24px_-8px_oklch(0_0_0/0.22)] ring-1 ring-foreground/15 transition-all duration-300 hover:-translate-y-0.5"
              >
                Find Paid Brand Deals →
              </Link>
              <a
                href="#how"
                className="rounded-xl border border-border bg-card-inner/60 px-6 py-3.5 text-sm font-semibold text-foreground backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:bg-card-inner"
              >
                See how it works
              </a>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Takes about 2 minutes. Free to start. No credit card.
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
