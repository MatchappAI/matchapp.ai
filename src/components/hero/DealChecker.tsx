import React, { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, ShieldCheck, ShieldQuestion, Sparkles, Lock } from "lucide-react";
import { Reveal } from "./Reveal";
import { SectionEyebrow } from "./SectionEyebrow";

type Verdict = "fair" | "low" | "walk" | "unclear";

type Teaser = {
  verdict: Verdict;
  headline: string;
  oneLiner: string;
  score: number; // 0-100
  flags: string[]; // full-only
  suggestedCounter: string | null; // full-only
};

// Fast, deterministic client-side heuristic so we can render a teaser without
// hitting the model. The full breakdown lives behind signup.
function analyze(text: string): Teaser {
  const t = text.toLowerCase();
  const flags: string[] = [];
  let score = 60;

  // Free product / gifting only
  if (/(gifted|gifting|free product|in exchange for|complimentary|product only)/.test(t)) {
    flags.push("High: gifted product only — no cash");
    score -= 30;
  }
  // Exposure pay
  if (
    /(exposure|for our platform|great opportunity|build your portfolio|tag us)/.test(t) &&
    !/\$\d/.test(t)
  ) {
    flags.push("High: 'exposure' framing without a cash rate");
    score -= 15;
  }
  // Perpetual / broad usage
  if (
    /(perpetual|in perpetuity|forever|unlimited use|all media|worldwide|whitelisting|paid ads)/.test(
      t,
    )
  ) {
    flags.push("High: broad/perpetual usage rights — price the usage separately");
    score -= 15;
  }
  // Exclusivity without pay bump
  if (/(exclusive|exclusivity|no competitors|category exclusive)/.test(t)) {
    flags.push("Medium: exclusivity clause — should carry a premium");
    score -= 8;
  }
  // Rush / short deadlines
  if (/(asap|rush|by tomorrow|within 24|by end of week|this week)/.test(t)) {
    flags.push("Medium: rush deadline — should carry a rush fee");
    score -= 5;
  }

  // Extract a dollar figure to gauge
  const dollarMatch = t.match(/\$\s?([\d,]+(?:\.\d+)?)\s?(k)?/);
  let dollars: number | null = null;
  if (dollarMatch) {
    dollars = Number(dollarMatch[1].replace(/,/g, ""));
    if (dollarMatch[2] === "k") dollars *= 1000;
    if (dollars < 100) {
      flags.push("High: sub-$100 flat fee for content work");
      score -= 15;
    } else if (dollars >= 100 && dollars < 350) {
      score -= 5;
    } else if (dollars >= 750) {
      score += 10;
    }
  }

  if (!/(deliverable|reel|tiktok|post|story|video|photo|clip|ugc|content)/.test(t)) {
    flags.push("Medium: deliverables are vague — ask for an exact list and revision limit");
    score -= 8;
  }
  if (!/(net\s?(15|30|45|60)|payment\s?(within|due|terms)|payable|invoice|days\s?after)/.test(t)) {
    flags.push("Medium: payment timing is missing — get a due date in writing");
    score -= 8;
  }
  if (
    /(whitelist|paid ads|boost|spark ads|allow us to run ads)/.test(t) &&
    !/(days|week|month|duration|term|window)/.test(t)
  ) {
    flags.push("High: whitelisting or paid usage is mentioned without a time limit");
    score -= 10;
  }

  // Positive signals
  if (/(net 30|net 15|invoice|contract|scope of work|deliverable)/.test(t)) {
    score += 8;
  }
  if (/(usage window|30 days|60 days|90 days|organic only)/.test(t)) {
    score += 6;
  }

  score = Math.max(5, Math.min(96, score));

  let verdict: Verdict = "unclear";
  if (score >= 70) verdict = "fair";
  else if (score >= 45) verdict = "low";
  else verdict = "walk";

  if (!dollarMatch && flags.length === 0) verdict = "unclear";

  const headline =
    verdict === "fair"
      ? "Looks fair — worth a counter"
      : verdict === "low"
        ? "Below market — counter or walk"
        : verdict === "walk"
          ? "Bad offer — do not accept as-is"
          : "Not enough detail to score confidently";

  const oneLiner =
    verdict === "fair"
      ? "The base rate and terms look defensible. A modest counter usually still lands."
      : verdict === "low"
        ? "The cash is too light for what they're asking. There's a specific counter that usually works."
        : verdict === "walk"
          ? "The math doesn't work for a creator at your stage. There's a clean way to say no and keep the door open."
          : "Paste the full offer — including rate, usage window, exclusivity, and deadline — for a sharper read.";

  const suggestedCounter =
    dollars != null
      ? verdict === "fair"
        ? `Counter around $${Math.round(dollars * 1.25).toLocaleString()} with a 60-day usage window.`
        : verdict === "low"
          ? `Counter around $${Math.round(dollars * 2).toLocaleString()} and cap usage at 30 days organic only.`
          : verdict === "walk"
            ? `If you engage at all, floor is $${Math.max(500, Math.round(dollars * 3)).toLocaleString()} with a strict scope.`
            : null
      : null;

  return { verdict, headline, oneLiner, score, flags, suggestedCounter };
}

const VERDICT_STYLES: Record<
  Verdict,
  { ring: string; text: string; icon: React.ReactNode; label: string }
> = {
  fair: {
    ring: "border-emerald-400/40 bg-emerald-500/[0.06]",
    text: "text-emerald-700 dark:text-emerald-300",
    icon: <ShieldCheck className="h-4 w-4" />,
    label: "Fair",
  },
  low: {
    ring: "border-amber-400/40 bg-amber-500/[0.06]",
    text: "text-amber-700 dark:text-amber-300",
    icon: <ShieldAlert className="h-4 w-4" />,
    label: "Low",
  },
  walk: {
    ring: "border-red-400/40 bg-red-500/[0.06]",
    text: "text-red-700 dark:text-red-300",
    icon: <ShieldAlert className="h-4 w-4" />,
    label: "Walk away",
  },
  unclear: {
    ring: "border-border/60 bg-card/40",
    text: "text-muted-foreground",
    icon: <ShieldQuestion className="h-4 w-4" />,
    label: "Unclear",
  },
};

export function DealChecker() {
  const [text, setText] = useState("");
  const [checked, setChecked] = useState(false);
  const result = useMemo(() => (checked ? analyze(text) : null), [text, checked]);

  return (
    <section id="deal-checker" className="mx-auto max-w-5xl px-4 sm:px-6 py-14 sm:py-20">
      <Reveal>
        <div className="text-center">
          <SectionEyebrow>DEAL CHECKER · FREE</SectionEyebrow>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Got a brand offer? Find out if it's actually fair.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            Paste any brand DM, email, or offer. MatchAI reads it for cash rate, usage rights,
            exclusivity, payment terms, and deadline — then tells you if it's fair, low, or a
            walk-away.
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur sm:p-6">
          <label
            htmlFor="deal-input"
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Paste the offer
          </label>
          <textarea
            id="deal-input"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (checked) setChecked(false);
            }}
            placeholder={
              "Hey! We'd love to gift you our new serum in exchange for one Reel and one Story tagging us. Could you post this weekend?"
            }
            className="mt-2 h-32 w-full resize-none rounded-xl border border-border/60 bg-background/60 p-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary/60 focus:outline-none"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground">
              Nothing is stored. The teaser runs on-device. Create your free account to see the full
              deal check.
            </p>
            <button
              type="button"
              disabled={text.trim().length < 12}
              onClick={() => setChecked(true)}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_8px_24px_-8px_oklch(0_0_0/0.22)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Check this offer
            </button>
          </div>

          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-5 space-y-4"
              >
                {/* Teaser (always visible) */}
                <div className={`rounded-2xl border p-5 ${VERDICT_STYLES[result.verdict].ring}`}>
                  <div
                    className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${VERDICT_STYLES[result.verdict].text}`}
                  >
                    {VERDICT_STYLES[result.verdict].icon}
                    Verdict · {VERDICT_STYLES[result.verdict].label}
                  </div>
                  <p className="mt-2 text-lg font-semibold text-foreground">{result.headline}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{result.oneLiner}</p>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
                      <span>Deal fairness</span>
                      <span>{result.score}/100</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-foreground/[0.06]">
                      <div
                        className={`h-full rounded-full ${
                          result.verdict === "fair"
                            ? "bg-emerald-500"
                            : result.verdict === "low"
                              ? "bg-amber-500"
                              : result.verdict === "walk"
                                ? "bg-red-500"
                                : "bg-muted-foreground"
                        }`}
                        style={{ width: `${result.score}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Full breakdown gate */}
                <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-background/60 p-5">
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background" />
                  <div className="relative">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <Lock className="h-3.5 w-3.5" /> Full breakdown
                    </div>
                    <ul className="mt-3 space-y-1.5 text-sm text-foreground/80">
                      {(result.flags.length > 0
                        ? result.flags.slice(0, 1)
                        : ["Line-by-line flags on usage, exclusivity, deadline, and payment terms"]
                      ).map((f, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-primary" />
                          <span>{f}</span>
                        </li>
                      ))}
                      <li className="flex gap-2 opacity-50 blur-[1.5px]">
                        <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-primary" />
                        <span>Specific counter language you can copy-paste</span>
                      </li>
                      <li className="flex gap-2 opacity-50 blur-[1.5px]">
                        <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-primary" />
                        <span>Rate benchmark for creators at your follower tier + niche</span>
                      </li>
                      <li className="flex gap-2 opacity-50 blur-[1.5px]">
                        <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-primary" />
                        <span>Red-flag scan across usage rights, exclusivity, payment terms</span>
                      </li>
                    </ul>

                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <Link
                        to="/auth"
                        className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_8px_24px_-8px_oklch(0_0_0/0.22)] transition-all hover:-translate-y-0.5"
                      >
                        <Sparkles className="mr-1.5 inline h-4 w-4" />
                        Create your free account
                      </Link>
                      <p className="text-[11px] text-muted-foreground">
                        Free account. No card. Also unlocks your Inbox, brand matches, and pitch
                        drafts.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Reveal>
    </section>
  );
}
