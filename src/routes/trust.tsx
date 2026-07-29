import { createFileRoute, Link } from "@tanstack/react-router";
import { Navbar } from "@/components/hero/Navbar";
import { SiteFooter } from "@/components/hero/SiteFooter";
import { SectionEyebrow } from "@/components/hero/SectionEyebrow";

export const Route = createFileRoute("/trust")({
  head: () => ({
    meta: [
      { title: "Trust & controls · MatchAI" },
      {
        name: "description",
        content:
          "How MatchAI protects creators: approvals, honest external payment tracking, read-only social access, revocable connections, and clear data controls. Maintained by the MatchAI team.",
      },
      { property: "og:title", content: "Trust & controls · MatchAI" },
      {
        property: "og:description",
        content:
          "Approvals, honest external payment tracking, read-only social access, revocable connections, and clear data controls.",
      },
    ],
  }),
  component: TrustPage,
});

type Section = {
  title: string;
  body: string;
  points: string[];
};

const sections: Section[] = [
  {
    title: "Approvals & agent behavior",
    body: "MatchAI is an assistant, not an autonomous agent. Every outbound message — DM, email, counter, or send — waits for your explicit approval in the app.",
    points: [
      "No message goes out without you tapping Approve.",
      "You can edit drafts, change rate, or skip a brand at any step.",
      "The agent never poses as you in 1:1 chats without a draft you approved.",
    ],
  },
  {
    title: "Payments & external status tracking",
    body: "Deals you close in MatchAI are tracked as creator-reported external payments. MatchAI does not hold funds or process payouts.",
    points: [
      "Creator-brand payment happens outside MatchAI.",
      "You can record due / paid externally status on the deal for organization.",
      "Disputes are logged with the original deal context, not lost in DMs.",
    ],
  },
  {
    title: "Social access — read-only by default",
    body: "When you connect Instagram, TikTok, YouTube, or X, MatchAI starts in read-only mode so it can surface brand leads without acting on your accounts.",
    points: [
      "Read scopes are the default — write access is opt-in, per platform.",
      "You can revoke access for any connected account in one click from Settings.",
      "We do not post or DM on your behalf without an approved draft.",
    ],
  },
  {
    title: "Your data, your control",
    body: "Your account, profile, voice samples, drafts, and deal history belong to you.",
    points: [
      "Export your data from Settings whenever you want.",
      "Delete your account and we remove your personal records on a documented schedule.",
      "We don't sell your data to brands, agencies, or third parties.",
    ],
  },
  {
    title: "AI ethics",
    body: "MatchAI uses AI to draft outreach, suggest rates, and triage replies — always under your review.",
    points: [
      "Drafts are tuned from your public content and the brand context, not from other creators' private messages.",
      "Rate suggestions are directional. They are starting points, not guarantees.",
      "We flag low-ball offers and obvious scams, but final judgment stays with you.",
    ],
  },
  {
    title: "Security practices",
    body: "We follow standard secure-development practices for a modern web product.",
    points: [
      "Transport is encrypted in flight.",
      "Authentication uses industry-standard providers; you can sign in with email or Google.",
      "Sensitive secrets are stored in server-side configuration, not in client code.",
    ],
  },
];

function TrustPage() {
  return (
    <div className="grain relative bg-background">
      <div className="relative mx-auto max-w-5xl px-4 sm:px-6">
        <Navbar />

        <header className="pt-10 pb-12 sm:pt-16 sm:pb-16">
          <SectionEyebrow>TRUST & CONTROLS</SectionEyebrow>
          <h1 className="mt-6 text-3xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            How MatchAI protects creators.
          </h1>
          <p className="mt-5 max-w-2xl text-[15.5px] leading-[1.7] text-muted-foreground">
            This page is maintained by the MatchAI team to answer the questions creators ask before
            connecting their accounts. It is app-owned content, not an independent audit or
            certification.
          </p>
        </header>

        <main className="space-y-6 pb-16">
          {sections.map((s) => (
            <section
              key={s.title}
              className="rounded-2xl border border-border/60 bg-card/40 p-6 sm:p-7 backdrop-blur"
            >
              <h2 className="text-lg font-semibold text-foreground sm:text-xl">{s.title}</h2>
              <p className="mt-3 text-[14.5px] leading-[1.7] text-muted-foreground">{s.body}</p>
              <ul className="mt-4 space-y-2 text-[14px] text-foreground/90">
                {s.points.map((p) => (
                  <li key={p} className="flex gap-2.5">
                    <span
                      aria-hidden
                      className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-primary/80"
                    />
                    <span className="leading-snug">{p}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section className="rounded-2xl border border-border/60 bg-card/40 p-6 sm:p-7 backdrop-blur">
            <h2 className="text-lg font-semibold text-foreground sm:text-xl">
              Questions or a security report
            </h2>
            <p className="mt-3 text-[14.5px] leading-[1.7] text-muted-foreground">
              For security disclosures, privacy questions, or a copy of our subprocessor list,
              contact the MatchAI team from your account or via the contact link in the footer.
              We'll respond within a reasonable window.
            </p>
          </section>

          <div className="pt-2">
            <Link
              to="/"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 rounded-md"
            >
              ← Back to home
            </Link>
          </div>
        </main>
      </div>

      <SiteFooter />
    </div>
  );
}
