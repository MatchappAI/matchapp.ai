import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Link } from "@tanstack/react-router";
import { Navbar } from "./Navbar";
import { StatCard } from "./StatCard";

import { LandingAgentChat } from "./LandingAgentChat";
import { useIsSignedIn } from "@/hooks/useIsSignedIn";

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const mockY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, 60]);
  const signedIn = useIsSignedIn();

  return (
    <div ref={ref} className="relative overflow-hidden">
      {/* Hero background kept intentionally neutral — ambient blobs live in deeper sections only */}

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <Navbar />

        <section className="grid grid-cols-1 items-center gap-8 pt-6 pb-8 sm:gap-6 sm:pt-8 sm:pb-12 lg:grid-cols-12 lg:gap-8 lg:pt-12 lg:pb-16">
          <motion.div style={{ y: textY }} className="lg:col-span-5">
            <motion.h1
              initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.9, delay: 0.1, ease: [0.2, 0.8, 0.2, 1] }}
              className="text-[2.6rem] font-bold leading-[1.04] tracking-[-0.022em] text-foreground sm:text-5xl lg:text-[3.65rem]"
            >
              Find paid brand deals without the pitching, chasing, or bad offers.{" "}
              <span className="bg-gradient-to-br from-[#1E1B4B] via-[#4F46E5] to-[#8B5CF6] bg-clip-text text-transparent">
                Keep payment external.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.25 }}
              className="mt-6 max-w-md text-[15.5px] leading-[1.7] text-muted-foreground/90"
            >
              MatchAI helps UGC creators and micro-influencers find brand-fit opportunities, write
              pitches in their voice, track replies, know what to charge, check offer terms, and
              turn brand conversations into paid deals. You just tap{" "}
              <span className="font-semibold text-foreground">Approve</span>.
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.28 }}
              className="mt-3 max-w-md text-[13.5px] leading-[1.6] text-foreground/75"
            >
              You already make the content. MatchAI helps you find the deals that fit it and close
              them cleanly.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.32 }}
              className="mt-4 flex flex-wrap gap-1.5 text-[11px] font-medium text-muted-foreground"
            >
              {[
                "Skincare UGC",
                "Beauty launches",
                "Sponsored fashion",
                "Paid social creative",
                "Affiliate + flat-fee",
                "Content retainers",
              ].map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-border/70 bg-card/40 px-2.5 py-1"
                >
                  {t}
                </span>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.35 }}
              className="mt-8 flex flex-wrap gap-3"
            >
              {signedIn ? (
                <>
                  <Link
                    to="/dashboard"
                    className="btn-sheen group relative rounded-xl bg-primary hover:bg-primary/90 transition-colors px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-[0_8px_24px_-8px_oklch(0_0_0/0.22)] ring-1 ring-foreground/15 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_oklch(0_0_0/0.22)]"
                  >
                    Open my agent →
                  </Link>
                  <a
                    href="#how"
                    className="rounded-xl border border-border bg-card/40 px-6 py-3.5 text-sm font-semibold text-foreground backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:bg-card/70"
                  >
                    See how it works →
                  </a>
                </>
              ) : (
                <>
                  <Link
                    to="/auth"
                    className="btn-sheen group relative rounded-xl bg-primary hover:bg-primary/90 transition-colors px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-[0_8px_24px_-8px_oklch(0_0_0/0.22)] ring-1 ring-foreground/15 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_oklch(0_0_0/0.22)]"
                  >
                    Find Paid Brand Deals →
                  </Link>
                  <a
                    href="#how"
                    className="rounded-xl border border-border bg-card/40 px-6 py-3.5 text-sm font-semibold text-foreground backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:bg-card/70"
                  >
                    See how it works
                  </a>
                </>
              )}
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.42 }}
              className="mt-5 max-w-md text-[14px] font-semibold leading-snug text-foreground"
            >
              Start free. MatchAI subscriptions keep the product running while creator-brand payment
              stays outside MatchAI.
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              Free to start · No credit card · Internal creator email included · External provider
              stays off until selected
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.45 }}
              className="mt-8 lg:hidden"
            >
              {!signedIn && <LandingAgentChat />}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.55 }}
              className="mt-8 grid grid-cols-1 gap-2.5 sm:grid-cols-3"
            >
              <StatCard
                tone="violet"
                value="2 min"
                label="From sign-up to your first ranked brand matches."
              />
              <StatCard
                tone="sky"
                value="One inbox"
                label="Every brand thread, pitch, reply, and draft in one place."
              />
              <StatCard
                tone="emerald"
                value="Manual + CSV"
                label="Add brands and contacts by hand or import them in bulk."
              />
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1.1, delay: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            style={{ y: mockY }}
            className="relative hidden lg:col-span-7 lg:block"
          >
            {/* Glow halo behind mockup */}
            <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[2.5rem] bg-[radial-gradient(ellipse_at_center,oklch(0.55_0.22_295/0.18),transparent_70%)] pulse-glow blur-2xl" />
            <div className="float-slow">
              <LandingAgentChat />
            </div>
          </motion.div>
        </section>

        <footer className="flex flex-col items-start justify-between gap-4 border-t border-border/60 py-6 sm:flex-row sm:items-center">
          <p className="text-xs text-muted-foreground">
            For creators doing this solo — no manager, no agency, no monthly retainer.
          </p>
          <div className="flex flex-wrap gap-2 text-[10.5px] font-semibold tracking-wider text-muted-foreground">
            {["REAL BRANDS ONLY", "YOU APPROVE EVERY SEND", "PAYMENT STAYS EXTERNAL"].map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/40 px-3 py-1.5 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:text-foreground"
              >
                <span className="h-1 w-1 rounded-full bg-primary/70" />
                {t}
              </span>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
}
